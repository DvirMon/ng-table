// Closes issues named in "Ships: #N" trailers once CI is green, and rolls
// epics (issues with native sub-issues) up or back down as their sub-issues
// close and reopen. Run by .github/workflows/close-linked-issue-on-ci-green.yml.
// Contract: docs/agents/issue-tracker.md#closing-trailer.
//
// Issues closed here with GITHUB_TOKEN raise no `issues` event, so the epic
// roll-up after a ship close is called directly, not left to the trigger.

const { parseTrailers } = require('../../tools/commit-trailers.cjs');

const SHIP_MARKER = '<!-- ci-green-autoclose -->';
const EPIC_CLOSE_MARKER = '<!-- epic-autoclose -->';
const EPIC_READY_MARKER = '<!-- epic-ready-to-close -->';
const READY_LABEL = 'ready-to-close';
const BOT_LOGIN = 'github-actions[bot]';
const UNCHECKED_BOX = /^\s*-\s\[ \]/gm;

const ISSUE_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        number
        state
        parent { number }
        subIssuesSummary { total completed }
        subIssues(first: 100) { nodes { number state title } }
      }
    }
  }`;

module.exports = async function main({ github, context, core }) {
  const { owner, repo } = context.repo;

  // ---- GitHub reads ---------------------------------------------------

  async function hierarchy(number) {
    const data = await github.graphql(ISSUE_QUERY, { owner, repo, number });
    return data.repository.issue;
  }

  async function comments(number) {
    return github.paginate(github.rest.issues.listComments, {
      owner, repo, issue_number: number, per_page: 100,
    });
  }

  async function hasComment(number, marker) {
    return (await comments(number)).some((c) =>
      (c.body ?? '').includes(marker),
    );
  }

  async function wasLastClosedByBot(number) {
    const events = await github.paginate(github.rest.issues.listEvents, {
      owner, repo, issue_number: number, per_page: 100,
    });
    const lastClose = events.filter((e) => e.event === 'closed').at(-1);
    return lastClose?.actor?.login === BOT_LOGIN;
  }

  function uncheckedBoxes(body) {
    return ((body ?? '').match(UNCHECKED_BOX) ?? []).length;
  }

  function openSubIssues(node) {
    return node.subIssues.nodes.filter((s) => s.state === 'OPEN');
  }

  // ---- GitHub writes --------------------------------------------------

  async function comment(number, body) {
    await github.rest.issues.createComment({
      owner, repo, issue_number: number, body,
    });
  }

  async function ensureLabel(number, name) {
    try {
      await github.rest.issues.createLabel({
        owner, repo, name, color: '0e8a16',
        description: 'Every sub-issue is closed; the epic has items left',
      });
    } catch (err) {
      if (err.status !== 422) throw err; // 422: already exists
    }
    await github.rest.issues.addLabels({
      owner, repo, issue_number: number, labels: [name],
    });
  }

  async function removeLabel(number, name) {
    try {
      await github.rest.issues.removeLabel({
        owner, repo, issue_number: number, name,
      });
    } catch (err) {
      if (err.status !== 404) throw err; // 404: label not on the issue
    }
  }

  // ---- Epic roll-up ---------------------------------------------------

  // Walks up from a closed issue: each parent whose sub-issues are now all
  // closed either closes (and the walk continues) or is flagged.
  async function rollUpClose(childNumber, log) {
    const child = await hierarchy(childNumber);
    const parentNumber = child.parent?.number;
    if (!parentNumber) return;

    const parent = await hierarchy(parentNumber);
    const { total, completed } = parent.subIssuesSummary;
    const hasOpenSubIssues = completed < total;
    if (parent.state !== 'OPEN' || hasOpenSubIssues) {
      log(`epic #${parentNumber}: ${completed}/${total} sub-issues closed, ` +
        `state ${parent.state} — left as is.`);
      return;
    }

    const { data: issue } = await github.rest.issues.get({
      owner, repo, issue_number: parentNumber,
    });
    const boxesLeft = uncheckedBoxes(issue.body);
    if (boxesLeft > 0) {
      await ensureLabel(parentNumber, READY_LABEL);
      if (!(await hasComment(parentNumber, EPIC_READY_MARKER))) {
        await comment(parentNumber,
          `${EPIC_READY_MARKER}\nAll ${total} sub-issues are closed, but ` +
          `this epic still has ${boxesLeft} unchecked item(s) of its own. ` +
          `Labelled \`${READY_LABEL}\` — close it once they are done.`);
      }
      log(`epic #${parentNumber}: all sub-issues closed, ${boxesLeft} ` +
        `box(es) left — labelled ${READY_LABEL}.`);
      return;
    }

    await github.rest.issues.update({
      owner, repo, issue_number: parentNumber,
      state: 'closed', state_reason: 'completed',
    });
    await removeLabel(parentNumber, READY_LABEL);
    await comment(parentNumber,
      `${EPIC_CLOSE_MARKER}\nClosed automatically — all ${total} ` +
      `sub-issues are closed (last: #${childNumber}).`);
    log(`epic #${parentNumber}: closed — all ${total} sub-issues closed.`);
    await rollUpClose(parentNumber, log);
  }

  // Walks up from a reopened issue: a parent the bot closed reopens; a
  // parent flagged ready-to-close loses the flag.
  async function rollUpReopen(childNumber, log) {
    const child = await hierarchy(childNumber);
    const parentNumber = child.parent?.number;
    if (!parentNumber) return;

    const parent = await hierarchy(parentNumber);
    if (parent.state === 'OPEN') {
      await removeLabel(parentNumber, READY_LABEL);
      log(`epic #${parentNumber}: open — ${READY_LABEL} removed if set.`);
      return;
    }
    if (!(await wasLastClosedByBot(parentNumber))) {
      log(`epic #${parentNumber}: closed by a person — left closed.`);
      return;
    }

    await github.rest.issues.update({
      owner, repo, issue_number: parentNumber, state: 'open',
    });
    await comment(parentNumber,
      `${EPIC_CLOSE_MARKER}\nReopened automatically — sub-issue ` +
      `#${childNumber} was reopened.`);
    log(`epic #${parentNumber}: reopened — #${childNumber} reopened.`);
    await rollUpReopen(parentNumber, log);
  }

  // ---- Ship on CI green -------------------------------------------------

  const wr = context.payload.workflow_run;

  async function previousGreenSha() {
    const { data } = await github.rest.actions.listWorkflowRuns({
      owner, repo,
      workflow_id: wr.workflow_id,
      branch: 'main',
      event: 'push',
      status: 'success',
      per_page: 20,
    });
    const earlier = data.workflow_runs
      .filter((r) => r.id !== wr.id)
      .filter((r) => new Date(r.created_at) < new Date(wr.created_at))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return earlier[0]?.head_sha ?? null;
  }

  // Every commit pushed since the last green CI run on main. The
  // workflow_run payload only carries head_commit, so a push of N commits
  // would otherwise leave N-1 commit messages unread.
  async function commitsSinceLastGreen() {
    const fallback = wr.head_commit
      ? [{ sha: wr.head_sha, message: wr.head_commit.message }]
      : [];
    const base = await previousGreenSha();
    if (!base || base === wr.head_sha) {
      core.info('No usable previous green run — scanning head commit only.');
      return fallback;
    }
    try {
      const { data } = await github.rest.repos.compareCommits({
        owner, repo, base, head: wr.head_sha,
      });
      core.info(`Scanning ${data.commits.length} commit(s) in ` +
        `${base.slice(0, 7)}..${wr.head_sha.slice(0, 7)}.`);
      const commits = data.commits.map((c) => ({
        sha: c.sha, message: c.commit.message,
      }));
      return commits.length > 0 ? commits : fallback;
    } catch (err) {
      core.warning(`compareCommits failed: ${err.message}. ` +
        'Falling back to head commit.');
      return fallback;
    }
  }

  // issueNumber -> sources ("PR #12", "abc1234")
  async function collectShipTargets() {
    const targets = new Map();
    const add = (text, source) => {
      for (const n of parseTrailers(text).ships) {
        if (!targets.has(n)) targets.set(n, []);
        const sources = targets.get(n);
        if (!sources.includes(source)) sources.push(source);
      }
    };

    if (wr.pull_requests.length > 0) {
      for (const linked of wr.pull_requests) {
        const { data: pr } = await github.rest.pulls.get({
          owner, repo, pull_number: linked.number,
        });
        const isOpenIntoMain = pr.state === 'open' && pr.base.ref === 'main';
        if (!isOpenIntoMain) {
          core.info(`Skipping PR #${pr.number} ` +
            `(state=${pr.state}, base=${pr.base.ref}).`);
          continue;
        }
        add(pr.body, `PR #${pr.number}`);
      }
      return { trigger: 'pull_request', targets };
    }

    const isPushToMain = wr.event === 'push' && wr.head_branch === 'main';
    if (isPushToMain) {
      for (const c of await commitsSinceLastGreen()) {
        add(c.message, c.sha.slice(0, 7));
      }
      return { trigger: 'push to main', targets };
    }

    core.info(`Nothing to do: event=${wr.event}, branch=${wr.head_branch}.`);
    return { trigger: '', targets };
  }

  // Returns [issue, title, source, boxes, result] for the summary table.
  async function shipIssue(number, source, log) {
    let issue;
    try {
      ({ data: issue } = await github.rest.issues.get({
        owner, repo, issue_number: number,
      }));
    } catch (err) {
      return [`#${number}`, '—', source, '—', `not found (${err.status})`];
    }
    if (issue.pull_request) {
      return [`#${number}`, issue.title, source, '—', 'is a PR'];
    }

    const isClosed = issue.state === 'closed';
    if (isClosed && (await hasComment(number, SHIP_MARKER))) {
      return [`#${number}`, issue.title, source, '—', 'already shipped'];
    }

    const node = await hierarchy(number);
    const openSubs = openSubIssues(node);
    if (openSubs.length > 0) {
      const blockMarker = `<!-- epic-ship-blocked:${wr.head_sha} -->`;
      if (!(await hasComment(number, blockMarker))) {
        await comment(number,
          `${blockMarker}\nNot closed — \`Ships: #${number}\` in ` +
          `${source}, but this epic still has open sub-issues:\n` +
          openSubs.map((s) => `- #${s.number} ${s.title}`).join('\n') +
          `\n\nIt closes on its own once they do.`);
      }
      return [`#${number}`, issue.title, source, '—',
        `blocked: ${openSubs.length} open sub-issue(s)`];
    }

    // Any acceptance-criteria box still unchecked here was left that way by
    // /implement because only the suite proves it. CI green is that proof.
    const body = issue.body ?? '';
    const flipped = uncheckedBoxes(body);
    await github.rest.issues.update({
      owner, repo, issue_number: number,
      state: 'closed', state_reason: 'completed',
      ...(flipped > 0 ? { body: body.replace(/^(\s*-\s\[) \]/gm, '$1x]') } : {}),
    });
    const provenance = wr.pull_requests.length > 0 ? source : `commit ${source}`;
    await comment(number,
      `${SHIP_MARKER}\nClosed automatically — CI passed on ${provenance} ` +
      `([run](${wr.html_url})).` +
      (flipped > 0
        ? `\n\n${flipped} remaining acceptance ` +
          `criteri${flipped === 1 ? 'on' : 'a'} checked off.`
        : ''));
    log(`#${number} "${issue.title}" closed, ${flipped} box(es), ${source}.`);

    await rollUpClose(number, log);
    return [`#${number}`, issue.title, source, String(flipped),
      isClosed ? 'closed (was already)' : 'closed'];
  }

  async function onCiGreen() {
    const { trigger, targets } = await collectShipTargets();
    const epicLog = [];
    const log = (line) => { core.info(line); epicLog.push(line); };

    const rows = [];
    for (const [number, sources] of targets) {
      rows.push(await shipIssue(number, sources.join(', '), log));
    }

    const closedCount = rows.filter((r) => r[4].startsWith('closed')).length;
    core.notice(targets.size === 0
      ? `No Ships: trailers found (${trigger || 'no matching trigger'})`
      : `${closedCount} issue(s) closed from ${trigger}: ` +
        rows.map((r) => r[0]).join(', '));

    core.summary.addHeading('Close linked issue on CI green', 2);
    core.summary.addRaw(
      `Trigger: \`${trigger || 'none'}\` · head \`${wr.head_sha.slice(0, 7)}\`` +
      ` · [CI run](${wr.html_url})`, true);
    if (rows.length > 0) {
      core.summary.addTable([
        ['Issue', 'Title', 'Source', 'Boxes', 'Result'].map(
          (h) => ({ data: h, header: true })),
        ...rows,
      ]);
    } else {
      core.summary.addRaw('\nNo `Ships: #N` trailer found.', true);
    }
    if (epicLog.length > 0) core.summary.addList(epicLog);
    await core.summary.write();
  }

  // ---- Manual close / reopen --------------------------------------------

  async function onIssueEvent() {
    const { action, issue } = context.payload;
    const lines = [];
    const log = (line) => { core.info(line); lines.push(line); };
    if (action === 'closed') await rollUpClose(issue.number, log);
    if (action === 'reopened') await rollUpReopen(issue.number, log);
    if (lines.length === 0) log(`#${issue.number} ${action}: no parent epic.`);
    core.summary.addHeading(`Epic roll-up: #${issue.number} ${action}`, 2);
    core.summary.addList(lines);
    await core.summary.write();
  }

  if (context.eventName === 'workflow_run') await onCiGreen();
  if (context.eventName === 'issues') await onIssueEvent();
};

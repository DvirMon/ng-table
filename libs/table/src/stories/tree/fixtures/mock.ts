import type { TaskRow } from './types';

/** Flat project plan, 25 rows, depth 0-3, three roots. Searching "review" hits a deep leaf under
 * non-matching ancestors, a leaf in another branch, and a parent with non-matching children;
 * one branch has no match. */
export const TREE_ROWS_MOCK: TaskRow[] = [
  // Root 1: "Plan Architecture" — depth 0 parent
  {
    id: 't1',
    parentId: null,
    name: 'Plan Architecture',
    owner: 'Alice',
    status: 'In Progress',
  },
  // Depth 1 under t1: "API Design" — parent
  {
    id: 't2',
    parentId: 't1',
    name: 'API Design',
    owner: 'Bob',
    status: 'In Progress',
  },
  // Depth 2 under t2: "Security Spec" — parent with children that match "review"
  {
    id: 't3',
    parentId: 't2',
    name: 'Security Spec',
    owner: 'Carol',
    status: 'Pending',
  },
  // Depth 3 under t3: "Review Checklist" — CASE 1: depth-3 leaf under two non-matching ancestors
  {
    id: 't4',
    parentId: 't3',
    name: 'Review Checklist',
    owner: 'Dave',
    status: 'Completed',
  },
  // Depth 3 under t3: "Approval Matrix" — leaf, sibling to t4
  {
    id: 't5',
    parentId: 't3',
    name: 'Approval Matrix',
    owner: 'Eve',
    status: 'Completed',
  },
  // Depth 2 under t2: "Performance Targets" — leaf, sibling to t3
  {
    id: 't6',
    parentId: 't2',
    name: 'Performance Targets',
    owner: 'Frank',
    status: 'Pending',
  },
  // Depth 1 under t1: "Documentation" — parent, sibling to t2
  {
    id: 't7',
    parentId: 't1',
    name: 'Documentation',
    owner: 'Grace',
    status: 'In Progress',
  },
  // Depth 2 under t7: "API Review" — CASE 3: parent with matching name, non-matching children
  {
    id: 't8',
    parentId: 't7',
    name: 'API Review',
    owner: 'Hank',
    status: 'In Progress',
  },
  // Depth 3 under t8: "Security Notes" — leaf, child of matching parent
  {
    id: 't9',
    parentId: 't8',
    name: 'Security Notes',
    owner: 'Ivy',
    status: 'Completed',
  },
  // Depth 2 under t7: "User Guide" — leaf, sibling to t8
  {
    id: 't10',
    parentId: 't7',
    name: 'User Guide',
    owner: 'Jack',
    status: 'Pending',
  },
  // Depth 2 under t7: "Database Setup" — parent, sibling to t8 and t10
  {
    id: 't12',
    parentId: 't7',
    name: 'Database Setup',
    owner: 'Leo',
    status: 'Pending',
  },
  // Depth 3 under t12: "Schema Design" — leaf
  {
    id: 't13',
    parentId: 't12',
    name: 'Schema Design',
    owner: 'Mia',
    status: 'Pending',
  },
  // Depth 3 under t12: "Migration Scripts" — leaf, sibling to t13
  {
    id: 't14',
    parentId: 't12',
    name: 'Migration Scripts',
    owner: 'Noah',
    status: 'Pending',
  },
  // Depth 2 under t7: "Deployment Config" — leaf, sibling to t12
  {
    id: 't15',
    parentId: 't7',
    name: 'Deployment Config',
    owner: 'Olivia',
    status: 'Pending',
  },
  // Depth 1 under t1: "Infrastructure" — leaf, sibling to t7
  {
    id: 't11',
    parentId: 't1',
    name: 'Infrastructure',
    owner: 'Kate',
    status: 'Pending',
  },

  // Root 2: "Review Process" — depth 0 leaf, CASE 2: another leaf matching "review" in different branch
  {
    id: 't16',
    parentId: null,
    name: 'Review Process',
    owner: 'Peter',
    status: 'Completed',
  },

  // Root 3: "Code Standards" — depth 0 parent; nothing in this branch matches "review"
  {
    id: 't17',
    parentId: null,
    name: 'Code Standards',
    owner: 'Quinn',
    status: 'In Progress',
  },
  // Depth 1 under t17: "Python Standards" — parent
  {
    id: 't18',
    parentId: 't17',
    name: 'Python Standards',
    owner: 'Rachel',
    status: 'Pending',
  },
  // Depth 2 under t18: "Linting Rules" — parent
  {
    id: 't19',
    parentId: 't18',
    name: 'Linting Rules',
    owner: 'Sam',
    status: 'Pending',
  },
  // Depth 3 under t19: "Flake8 Config" — leaf
  {
    id: 't20',
    parentId: 't19',
    name: 'Flake8 Config',
    owner: 'Tina',
    status: 'Pending',
  },
  // Depth 2 under t18: "Type Checking" — leaf, sibling to t19
  {
    id: 't21',
    parentId: 't18',
    name: 'Type Checking',
    owner: 'Uma',
    status: 'Pending',
  },
  // Depth 1 under t17: "JavaScript Standards" — parent, sibling to t18
  {
    id: 't22',
    parentId: 't17',
    name: 'JavaScript Standards',
    owner: 'Victor',
    status: 'Pending',
  },
  // Depth 2 under t22: "ESLint Config" — parent
  {
    id: 't23',
    parentId: 't22',
    name: 'ESLint Config',
    owner: 'Wendy',
    status: 'Pending',
  },
  // Depth 3 under t23: "Rules Setup" — leaf
  {
    id: 't24',
    parentId: 't23',
    name: 'Rules Setup',
    owner: 'Xavier',
    status: 'Pending',
  },
  // Depth 2 under t22: "Prettier Config" — leaf, sibling to t23
  {
    id: 't25',
    parentId: 't22',
    name: 'Prettier Config',
    owner: 'Yara',
    status: 'Pending',
  },
];

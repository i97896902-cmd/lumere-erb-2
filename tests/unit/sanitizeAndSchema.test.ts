import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  stripUndefined,
  formatLocalDate,
  formatLocalYMD,
  escapeCsvCell,
} from '../../src/utils/sanitize';

test('stripUndefined removes top-level and nested undefined keys while preserving falsy/null values', () => {
  const input = {
    name: 'Luméré',
    count: 0,
    active: false,
    empty: '',
    nullable: null,
    optionalUndefined: undefined,
    nested: {
      keep: 'ok',
      drop: undefined,
      arr: [1, undefined, { a: 'x', b: undefined }, null],
    },
  };

  const cleaned = stripUndefined(input) as Record<string, unknown>;
  assert.equal('optionalUndefined' in cleaned, false);
  assert.equal(cleaned.name, 'Luméré');
  assert.equal(cleaned.count, 0);
  assert.equal(cleaned.active, false);
  assert.equal(cleaned.empty, '');
  assert.equal(cleaned.nullable, null);

  const nested = cleaned.nested as Record<string, unknown>;
  assert.equal('drop' in nested, false);
  assert.equal(nested.keep, 'ok');
  assert.deepEqual(nested.arr, [1, { a: 'x' }, null]);
});

test('formatLocalDate and formatLocalYMD produce zero-padded YYYY-MM-DD in local time', () => {
  assert.equal(formatLocalYMD(2026, 0, 5), '2026-01-05');
  assert.equal(formatLocalYMD(2026, 11, 31), '2026-12-31');

  const d = new Date(2026, 4, 9, 23, 59, 59);
  assert.equal(formatLocalDate(d), '2026-05-09');
});

test('escapeCsvCell handles commas, quotes, newlines, and spreadsheet formula injection', () => {
  assert.equal(escapeCsvCell('Simple'), '"Simple"');
  assert.equal(escapeCsvCell('Hello, World'), '"Hello, World"');
  assert.equal(escapeCsvCell('Say "Hi"'), '"Say ""Hi"""');
  assert.equal(escapeCsvCell('Line1\nLine2'), '"Line1\nLine2"');

  // Formula-injection neutralization (=, +, -, @)
  assert.equal(escapeCsvCell('=CMD|"/C calc"!A0'), '"\'=CMD|""/C calc""!A0"');
  assert.equal(escapeCsvCell('+SUM(A1:A2)'), '"\'+SUM(A1:A2)"');
  assert.equal(escapeCsvCell('-1+1'), '"\'-1+1"');
  assert.equal(escapeCsvCell('@SUM(1,2)'), '"\'@SUM(1,2)"');
  assert.equal(escapeCsvCell(null), '""');
  assert.equal(escapeCsvCell(undefined), '""');
});

test('ClientType enum is synchronized across firebase-blueprint.json, firestore.rules, and ClientsView UI', () => {
  const root = process.cwd();
  const blueprint = JSON.parse(
    fs.readFileSync(path.join(root, 'firebase-blueprint.json'), 'utf8')
  );
  const rulesText = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const clientsViewText = fs.readFileSync(
    path.join(root, 'src/pages/organization/ClientsView.tsx'),
    'utf8'
  );

  const blueprintClientTypes: string[] =
    blueprint.entities.Client.properties.clientType.enum;

  for (const expectedType of ['individual', 'company', 'enterprise', 'government']) {
    assert.ok(
      blueprintClientTypes.includes(expectedType),
      `firebase-blueprint.json missing Client.clientType "${expectedType}"`
    );
    assert.ok(
      rulesText.includes(`'${expectedType}'`),
      `firestore.rules missing clientType "${expectedType}"`
    );
    assert.ok(
      clientsViewText.includes(expectedType),
      `ClientsView.tsx missing clientType "${expectedType}"`
    );
  }
});

test('ProjectStatus, EquipmentStatus, and TaskStatus/Priority stay synchronized between blueprint and firestore.rules', () => {
  const root = process.cwd();
  const blueprint = JSON.parse(
    fs.readFileSync(path.join(root, 'firebase-blueprint.json'), 'utf8')
  );
  const rulesText = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

  const checkEnumInRules = (entityName: string, propName: string) => {
    const values: string[] = blueprint.entities[entityName].properties[propName].enum;
    assert.ok(Array.isArray(values) && values.length > 0, `${entityName}.${propName} enum missing`);
    for (const val of values) {
      assert.ok(
        rulesText.includes(`'${val}'`),
        `firestore.rules missing ${entityName}.${propName} enum value "${val}"`
      );
    }
  };

  checkEnumInRules('Project', 'status');
  checkEnumInRules('Equipment', 'status');
  checkEnumInRules('Task', 'status');
  checkEnumInRules('Task', 'priority');
  checkEnumInRules('Company', 'status');
});

test('AUTH_DISABLED remains strictly false and primary Super Admin email is preserved', () => {
  const root = process.cwd();
  const authContext = fs.readFileSync(
    path.join(root, 'src/context/AuthContext.tsx'),
    'utf8'
  );
  const rbac = fs.readFileSync(path.join(root, 'src/utils/rbac.ts'), 'utf8');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

  assert.match(authContext, /AUTH_DISABLED\s*=\s*false/);
  assert.ok(rbac.includes('lumerecompany@gmail.com'));
  assert.ok(rules.includes('lumerecompany@gmail.com'));
});

import test from 'node:test';
import assert from 'node:assert';
import { StateMachine } from '../workflow/state-machine.js';

test('Status State Machine Unit Tests', async (t) => {
  await t.test('Citizen cannot transition any report status', () => {
    const res = StateMachine.validateTransition('submitted', 'under_review', {
      actorId: 'citizen-1',
      actorRole: 'citizen',
      actorName: 'Ramesh K.'
    });
    assert.strictEqual(res.allowed, false);
    assert.match(res.error || '', /not authorized/);
  });

  await t.test('Visitor cannot transition any report status', () => {
    const res = StateMachine.validateTransition('submitted', 'under_review', {
      actorId: 'visitor-1',
      actorRole: 'visitor',
      actorName: 'Visitor'
    });
    assert.strictEqual(res.allowed, false);
  });

  await t.test('Admin can move submitted -> under_review', () => {
    const res = StateMachine.validateTransition('submitted', 'under_review', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.'
    });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStatus, 'under_review');
  });

  await t.test('Admin can move under_review -> verified', () => {
    const res = StateMachine.validateTransition('under_review', 'verified', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.'
    });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStatus, 'verified');
  });

  await t.test('Admin can move verified -> assigned', () => {
    const res = StateMachine.validateTransition('verified', 'assigned', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.'
    });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStatus, 'assigned');
  });

  await t.test('Staff assigned can move assigned -> in_progress', () => {
    const res = StateMachine.validateTransition('assigned', 'in_progress', {
      actorId: 'staff-1',
      actorRole: 'staff',
      actorName: 'Arun K.',
      assigneeId: 'staff-1'
    });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStatus, 'in_progress');
  });

  await t.test('Staff cannot transition report assigned to another staff member', () => {
    const res = StateMachine.validateTransition('assigned', 'in_progress', {
      actorId: 'staff-2',
      actorRole: 'staff',
      actorName: 'Deepa M.',
      assigneeId: 'staff-1'
    });
    assert.strictEqual(res.allowed, false);
    assert.match(res.error || '', /directly assigned to them/);
  });

  await t.test('Staff cannot mark work_completed without proof photo and 10+ char note', () => {
    // Missing note and proof
    const res1 = StateMachine.validateTransition('in_progress', 'work_completed', {
      actorId: 'staff-1',
      actorRole: 'staff',
      actorName: 'Arun K.',
      assigneeId: 'staff-1',
      note: 'Done'
    });
    assert.strictEqual(res1.allowed, false);

    // Note < 10 chars ('Too short' = 9 chars)
    const res2 = StateMachine.validateTransition('in_progress', 'work_completed', {
      actorId: 'staff-1',
      actorRole: 'staff',
      actorName: 'Arun K.',
      assigneeId: 'staff-1',
      note: 'Too short',
      proofImageId: 'proof-1'
    });
    assert.strictEqual(res2.allowed, false);

    // Missing proof image
    const res3 = StateMachine.validateTransition('in_progress', 'work_completed', {
      actorId: 'staff-1',
      actorRole: 'staff',
      actorName: 'Arun K.',
      assigneeId: 'staff-1',
      note: 'Replaced electrical fuse on pillar 4'
    });
    assert.strictEqual(res3.allowed, false);

    // Valid note and proof
    const res4 = StateMachine.validateTransition('in_progress', 'work_completed', {
      actorId: 'staff-1',
      actorRole: 'staff',
      actorName: 'Arun K.',
      assigneeId: 'staff-1',
      note: 'Replaced electrical fuse on pillar 4 and tested luminaire.',
      proofImageId: 'proof-1'
    });
    assert.strictEqual(res4.allowed, true);
    assert.strictEqual(res4.nextStatus, 'work_completed');
  });

  await t.test('Staff cannot verify, reject, duplicate, or resolve', () => {
    const resVerify = StateMachine.validateTransition('submitted', 'verified', {
      actorId: 'staff-1',
      actorRole: 'staff',
      actorName: 'Arun K.'
    });
    assert.strictEqual(resVerify.allowed, false);

    const resResolve = StateMachine.validateTransition('work_completed', 'resolved', {
      actorId: 'staff-1',
      actorRole: 'staff',
      actorName: 'Arun K.',
      note: 'Final sign-off by staff',
      proofImageId: 'proof-1'
    });
    assert.strictEqual(resResolve.allowed, false);
  });

  await t.test('Two-Person Rule: Admin who completed work cannot sign off as Resolved', () => {
    const res = StateMachine.validateTransition('work_completed', 'resolved', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.',
      workCompleterId: 'admin-1', // SAME PERSON
      note: 'Verified the repair looks solid and safe.',
      proofImageId: 'proof-1'
    });
    assert.strictEqual(res.allowed, false);
    assert.match(res.error || '', /Two-person rule violation/);
  });

  await t.test('Two-Person Rule: Different Admin can approve and resolve with valid proof and note', () => {
    const res = StateMachine.validateTransition('work_completed', 'resolved', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.',
      workCompleterId: 'staff-1', // DIFFERENT PERSON
      note: 'Reviewed staff proof photo; luminaire verified operational on site.',
      proofImageId: 'proof-1'
    });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStatus, 'resolved');
  });

  await t.test('Illegal transitions are rejected: Submitted cannot jump to Resolved', () => {
    const res = StateMachine.validateTransition('submitted', 'resolved', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.',
      note: 'Trying to skip steps to resolve immediately'
    });
    assert.strictEqual(res.allowed, false);
    assert.match(res.error || '', /Illegal status transition/);
  });

  await t.test('Rejection requires reason with at least 10 characters', () => {
    const resShort = StateMachine.validateTransition('submitted', 'rejected', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.',
      note: 'Spam'
    });
    assert.strictEqual(resShort.allowed, false);
    assert.match(resShort.error || '', /at least 10 characters/);

    const resValid = StateMachine.validateTransition('submitted', 'rejected', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.',
      note: 'Not within municipal jurisdiction; referred to state highways.'
    });
    assert.strictEqual(resValid.allowed, true);
    assert.strictEqual(resValid.nextStatus, 'rejected');
  });

  await t.test('Duplicate requires parentReportId', () => {
    const resNoParent = StateMachine.validateTransition('under_review', 'duplicate', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.'
    });
    assert.strictEqual(resNoParent.allowed, false);
    assert.match(resNoParent.error || '', /active parent report/);

    const resValid = StateMachine.validateTransition('under_review', 'duplicate', {
      actorId: 'admin-1',
      actorRole: 'admin',
      actorName: 'Priya N.',
      parentReportId: 'CPR-2026-000100'
    });
    assert.strictEqual(resValid.allowed, true);
  });
});

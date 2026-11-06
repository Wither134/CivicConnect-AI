import test from 'node:test';
import assert from 'node:assert';
import { LockManager } from '../safeguards/lock-manager.js';

test('Concurrency & Optimistic Concurrency Tests', async (t) => {
  const reportId = 'rep-test-concurrent-1';
  LockManager.forceRelease(reportId);

  await t.test('Admin 1 takes 10-minute soft lock', () => {
    const res = LockManager.acquireLock(reportId, 'usr-admin-1', 'Priya N.', 'admin', 1);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.lock?.userId, 'usr-admin-1');
    assert.strictEqual(res.lock?.userName, 'Priya N.');
  });

  await t.test('Admin 2 attempts to lock the same report -> Blocked by active lock', () => {
    const res = LockManager.acquireLock(reportId, 'usr-admin-2', 'Vikram S.', 'admin', 1);
    assert.strictEqual(res.success, false);
    assert.match(res.message, /Priya N. is currently reviewing this report/);
  });

  await t.test('Admin 1 can renew their own lock', () => {
    const res = LockManager.acquireLock(reportId, 'usr-admin-1', 'Priya N.', 'admin', 1);
    assert.strictEqual(res.success, true);
    assert.match(res.message, /renewed successfully/);
  });

  await t.test('Optimistic concurrency: stale version update is rejected', () => {
    let currentVersion = 1;

    // Admin 1 edits and increments version
    currentVersion += 1; // Now version 2

    // Admin 2 tries to submit edit based on stale version 1
    const checkStale = LockManager.checkOptimisticConcurrency(1, currentVersion);
    assert.strictEqual(checkStale.valid, false);
    assert.match(checkStale.error || '', /Stale edit detected/);

    // Submission based on version 2 succeeds
    const checkFresh = LockManager.checkOptimisticConcurrency(2, currentVersion);
    assert.strictEqual(checkFresh.valid, true);
  });

  await t.test('Admin 1 releases lock -> Admin 2 can now acquire it', () => {
    const released = LockManager.releaseLock(reportId, 'usr-admin-1');
    assert.strictEqual(released, true);

    const resAdmin2 = LockManager.acquireLock(reportId, 'usr-admin-2', 'Vikram S.', 'admin', 2);
    assert.strictEqual(resAdmin2.success, true);
    assert.strictEqual(resAdmin2.lock?.userId, 'usr-admin-2');
  });

  await t.test('Expired lock automatically allows next user to acquire', () => {
    const expReportId = 'rep-test-expired';
    // Acquire with 1ms TTL
    LockManager.acquireLock(expReportId, 'usr-user-1', 'User 1', 'admin', 1, 1);

    // Busy wait 5ms for expiry
    const start = Date.now();
    while (Date.now() - start < 10) {}

    const resUser2 = LockManager.acquireLock(expReportId, 'usr-user-2', 'User 2', 'admin', 1);
    assert.strictEqual(resUser2.success, true);
    assert.strictEqual(resUser2.lock?.userId, 'usr-user-2');
  });
});


import test from 'node:test'
import assert from 'node:assert/strict'
import { initialWidgetTab, shouldScrollToWidgetTarget, widgetTargetId } from '../src/lib/androidWidgetNavigation.ts'

test('widget deep links open the shared space while ordinary app launch keeps the games tab', () => {
  assert.equal(initialWidgetTab('?widget=calendar'), 'us')
  assert.equal(initialWidgetTab('?widget=note'), 'us')
  assert.equal(initialWidgetTab(''), 'games')
})

test('widget feature routes target the existing shared-space sections', () => {
  assert.equal(widgetTargetId('plans'), 'calendar')
  assert.equal(widgetTargetId('voice'), 'note')
  assert.equal(widgetTargetId('board'), 'board')
})

test('widget section scrolling waits until the signed-in couple has loaded', () => {
  assert.equal(shouldScrollToWidgetTarget('note', false, ''), false)
  assert.equal(shouldScrollToWidgetTarget('note', true, 'couple-1'), false)
  assert.equal(shouldScrollToWidgetTarget('note', false, 'couple-1'), true)
  assert.equal(shouldScrollToWidgetTarget(undefined, false, 'couple-1'), false)
})

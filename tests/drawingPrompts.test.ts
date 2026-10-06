import test from 'node:test'
import assert from 'node:assert/strict'
import { DRAWING_PROMPTS, drawingCategories, drawingSubjectsForCategory, isPresetDrawingPrompt, validateDrawingPrompt } from '../src/lib/drawingPrompts.ts'

test('drawing catalog retains supplied subject and classification pairs', () => {
  assert.equal(DRAWING_PROMPTS.length, 150)
  assert.deepEqual(DRAWING_PROMPTS[0], { subject: 'The Hulk', category: 'Marvel Superhero' })
  assert.deepEqual(DRAWING_PROMPTS[2], { subject: 'Pikachu shooting electricity', category: 'Pokémon / Anime' })
  assert.deepEqual(DRAWING_PROMPTS.at(-1), { subject: "A metal knight's helmet with a red feather", category: 'Medieval Armor' })
})

test('drawing categories preserve first-seen order and filter subjects', () => {
  assert.deepEqual(drawingCategories().slice(0, 4), ['Marvel Superhero', 'Pokémon / Anime', 'Video Game Character', 'Cartoon Character'])
  assert.deepEqual(drawingSubjectsForCategory('Marvel Superhero'), ['The Hulk', 'Spider-Man swinging from a web', 'Iron Man flying in his suit'])
})

test('preset requires exact subject and category pair', () => {
  assert.equal(isPresetDrawingPrompt('The Hulk', 'Marvel Superhero'), true)
  assert.equal(isPresetDrawingPrompt('The Hulk', 'DC Superhero'), false)
  assert.equal(isPresetDrawingPrompt('The hulk', 'Marvel Superhero'), false)
})

test('custom prompts are trimmed and enforce length boundaries', () => {
  assert.deepEqual(validateDrawingPrompt('  My subject  ', '  My topic '), { subject: 'My subject', category: 'My topic' })
  assert.equal(validateDrawingPrompt('x'.repeat(120), 'y'.repeat(60)).subject.length, 120)
  assert.throws(() => validateDrawingPrompt(' ', 'topic'), /subject/i)
  assert.throws(() => validateDrawingPrompt('subject', ' '), /category/i)
  assert.throws(() => validateDrawingPrompt('x'.repeat(121), 'topic'), /subject/i)
  assert.throws(() => validateDrawingPrompt('subject', 'y'.repeat(61)), /category/i)
})

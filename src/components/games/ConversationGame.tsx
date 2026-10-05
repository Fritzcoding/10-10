import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { canRevealConversationRound, getLieDetectorReveal, validateConversationAnswer, validateLieDetectorRound, validateWhoIsMoreLikelyAnswer } from '../../lib/conversationGames'
import { expireConversationRound, getDescribeWord, startConversationGame, submitConversationAnswer, type ConversationGameRound, type ConversationGameSubmission, type GameSession } from '../../lib/gameSessions'
import { supabase } from '../../lib/supabase'
import { formatSupabaseDataError } from '../../lib/supabaseErrors'
import './ConversationGame.css'

type Prompt = { id: string; game_type: string; category: string; prompt: string; source_type: 'original' | 'couple'; source_name: string; source_license: string | null }
type RoundView = { round: ConversationGameRound; submissions: ConversationGameSubmission[]; prompt: Prompt | null }
const QUESTION_CATEGORIES = ['Getting to know each other', 'Memories', 'Everyday life', 'Future']

export default function ConversationGame({ session, userId, onExit }: { session: GameSession; userId: string; onExit: () => void }) {
  const gameId = session.game_type
  const [rounds, setRounds] = useState<RoundView[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [category, setCategory] = useState(QUESTION_CATEGORIES[0])
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [choice, setChoice] = useState<'me' | 'partner' | ''>('')
  const [statements, setStatements] = useState(['', '', ''])
  const [lieIndex, setLieIndex] = useState(0)
  const [guessIndex, setGuessIndex] = useState<number | null>(null)
  const [word, setWord] = useState<{ word: string; forbidden: string[] } | null>(null)
  const [describeGuess, setDescribeGuess] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newCategory, setNewCategory] = useState(QUESTION_CATEGORIES[0])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const expiredRound = useRef('')
  const requester = session.player_x_id === userId
  const current = rounds.at(-1)
  const isQuestionGame = gameId === 'question-cards' || gameId === 'whos-more-likely'
  const gameTitle = gameId === 'question-cards' ? 'Question Cards' : gameId === 'whos-more-likely' ? 'Who’s More Likely' : gameId === 'lie-detector' ? 'Lie Detector' : 'Describe Without Saying It'

  const refresh = useCallback(async () => {
    if (!supabase) return
    const client = supabase
    const { data: roundRows, error } = await client.from('conversation_game_rounds').select('*').eq('session_id', session.id).order('round_number', { ascending: true })
    if (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })); setLoading(false); return }
    const views = await Promise.all((roundRows ?? []).map(async (round) => {
      const [{ data: submissions }, { data: prompt }] = await Promise.all([
        client.from('conversation_game_submissions').select('*').eq('round_id', round.id),
        round.prompt_id && gameId !== 'describe-without-saying-it'
          ? client.from('game_prompts').select('id,game_type,category,prompt,source_type,source_name,source_license').eq('id', round.prompt_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      return { round: round as ConversationGameRound, submissions: (submissions ?? []) as ConversationGameSubmission[], prompt: prompt as Prompt | null }
    }))
    setRounds(views)
    setLoading(false)
  }, [gameId, session.id])

  useEffect(() => {
    if (!supabase || !isQuestionGame) return
    const client = supabase
    void client.from('game_prompts').select('id,game_type,category,prompt,source_type,source_name,source_license').eq('game_type', gameId).order('created_at').then(({ data, error }) => {
      if (error) setMessage(formatSupabaseDataError(error as { message?: string | null }))
      else {
        const available = (data ?? []) as Prompt[]
        setPrompts(available)
        setSelectedPrompt((currentId) => currentId || available[0]?.id || '')
      }
    })
  }, [gameId, isQuestionGame])

  useEffect(() => {
    queueMicrotask(() => void refresh())
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`conversation-game-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_game_rounds', filter: `session_id=eq.${session.id}` }, () => void refresh())
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh() })
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus); void client.removeChannel(channel) }
  }, [refresh, session.id])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const round = current?.round
    if (gameId !== 'describe-without-saying-it' || !round?.deadline_at || round.status !== 'active' || Date.parse(round.deadline_at) > now || expiredRound.current === round.id) return
    expiredRound.current = round.id
    void expireConversationRound(round.id).then(() => refresh()).catch((error) => setMessage(formatSupabaseDataError(error as { message?: string | null })))
  }, [current?.round, gameId, now, refresh])

  const visiblePrompts = useMemo(() => prompts.filter((prompt) => gameId !== 'question-cards' || prompt.category === category), [category, gameId, prompts])
  const submit = async (payload: Record<string, unknown>, publicState: Record<string, unknown> | null = null) => {
    if (!current) return
    setMessage('')
    try { await submitConversationAnswer(current.round.id, payload, publicState); setWord(null); await refresh() }
    catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) }
  }
  const start = async () => {
    setMessage('')
    try { await startConversationGame(session.id, isQuestionGame ? (visiblePrompts.some((prompt) => prompt.id === selectedPrompt) ? selectedPrompt : visiblePrompts[0]?.id ?? null) : null); await refresh() }
    catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) }
  }
  const createQuestion = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    const prompt = newQuestion.trim()
    if (!prompt || prompt.length > 280) { setMessage('Write a question between 1 and 280 characters.'); return }
    const { data, error } = await supabase.rpc('create_couple_question', { target_category: newCategory, target_prompt: prompt })
    if (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })); return }
    const added = data as Prompt
    setPrompts((currentPrompts) => [...currentPrompts, added])
    setSelectedPrompt(added.id)
    setCategory(added.category)
    setNewQuestion('')
    setMessage('Your question is ready to play.')
  }

  if (loading) return <section className="conversation-game"><button className="conversation-game__back" onClick={onExit} type="button">← All games</button><p role="status">Loading your game…</p></section>
  if (!current) return <section className="conversation-game">
    <button className="conversation-game__back" onClick={onExit} type="button">← All games</button>
    <p className="conversation-game__eyebrow">Together, one round at a time</p><h2>{gameTitle}</h2>
    {isQuestionGame && <>
      <label>Choose a category<select value={category} onChange={(event) => setCategory(event.target.value)}>{[...new Set([...QUESTION_CATEGORIES, ...prompts.map((prompt) => prompt.category)])].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Choose a question<select value={selectedPrompt} onChange={(event) => setSelectedPrompt(event.target.value)}>{visiblePrompts.map((prompt) => <option value={prompt.id} key={prompt.id}>{prompt.prompt}</option>)}</select></label>
      <details className="conversation-game__add"><summary>Add a question for us</summary><form onSubmit={(event) => void createQuestion(event)}><label>Category<select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>{QUESTION_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Your question<textarea maxLength={280} value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} /></label><button type="submit">Save question</button></form></details>
    </>}
    {requester ? <button className="conversation-game__primary" type="button" disabled={isQuestionGame && !selectedPrompt} onClick={() => void start()}>{isQuestionGame ? 'Start this question' : 'Start the first turn'}</button> : <p role="status">Waiting for your partner to start the first round.</p>}
    {message && <p className="conversation-game__message" role="alert">{message}</p>}
  </section>

  const round = current.round
  const own = current.submissions.find((item) => item.user_id === userId)
  const creatorAnswer = current.submissions.find((item) => item.user_id === round.creator_id)
  const guesserId = round.creator_id === session.player_x_id ? session.player_o_id : session.player_x_id
  const guesserAnswer = current.submissions.find((item) => item.user_id === guesserId)
  const revealed = round.status === 'completed' || canRevealConversationRound(current.submissions.length, round.deadline_at, new Date(now))
  const sessionCompleted = round.status === 'completed' && (isQuestionGame || round.round_number === 2)
  const remainingSeconds = round.deadline_at ? Math.max(0, Math.ceil((Date.parse(round.deadline_at) - now) / 1000)) : null
  const publicStatements = Array.isArray(round.public_state?.statements) ? round.public_state.statements as string[] : []

  return <section className="conversation-game">
    <button className="conversation-game__back" onClick={onExit} type="button">← All games</button>
    <p className="conversation-game__eyebrow">{gameTitle}{round.round_number > 1 ? ` · Round ${round.round_number} of 2` : ''}</p>
    {round.prompt_id && current.prompt && <div className="conversation-game__prompt"><small>{current.prompt.category}</small><h2>{current.prompt.prompt}</h2><small>Prompt: {current.prompt.source_type === 'original' ? current.prompt.source_name : 'Your shared question'}</small></div>}
    {remainingSeconds !== null && round.status === 'active' && <p className="conversation-game__timer" role="timer">{remainingSeconds}s left</p>}

    {revealed && <div className="conversation-game__reveal" role="status">
      <h3>{round.deadline_at && Date.parse(round.deadline_at) <= now && current.submissions.length < 2 ? 'Time’s up' : 'Here’s what you both said'}</h3>
      {gameId === 'lie-detector' && creatorAnswer && guesserAnswer && (() => { const result = getLieDetectorReveal(publicStatements, Number(creatorAnswer.answer.lie_index), Number(guesserAnswer.answer.guess_index)); return <><ol>{result.statements.map((item, index) => <li key={index}>{item.text}{item.isLie && <strong> · The lie</strong>}</li>)}</ol><p>{result.guessWasCorrect ? 'You found the lie!' : 'The lie fooled you this time.'}</p></> })()}
      {gameId === 'describe-without-saying-it' && creatorAnswer && <><p>The word was <strong>{String(creatorAnswer.answer.word)}</strong>.</p>{guesserAnswer && <p>Your guess: {String(guesserAnswer.answer.guess)} · {guesserAnswer.answer.correct ? 'Correct!' : 'Not quite'}</p>}</>}
      {gameId === 'question-cards' && current.submissions.map((item) => <p key={item.user_id}><strong>{item.user_id === userId ? 'You' : 'Your partner'}:</strong> {String(item.answer.answer)}</p>)}
      {gameId === 'whos-more-likely' && current.submissions.map((item) => <p key={item.user_id}><strong>{item.user_id === userId ? 'Your pick' : 'Partner pick'}:</strong> {item.answer.choice === 'me' ? (item.user_id === userId ? 'you' : 'your partner') : (item.user_id === userId ? 'your partner' : 'you')}</p>)}
    </div>}

    {gameId === 'question-cards' && round.status === 'active' && <>
      {own ? <p role="status">Your answer is saved. It will appear when your partner answers.</p> : <form onSubmit={(event) => { event.preventDefault(); try { void submit({ answer: validateConversationAnswer(answerText) }) } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) } }}><label>Your answer<textarea maxLength={1000} value={answerText} onChange={(event) => setAnswerText(event.target.value)} /></label><button className="conversation-game__primary" type="submit">Save my answer</button></form>}
    </>}
    {gameId === 'whos-more-likely' && round.status === 'active' && <>
      {own ? <p role="status">Your pick is saved. It will appear when your partner answers.</p> : <form onSubmit={(event) => { event.preventDefault(); try { void submit({ choice: validateWhoIsMoreLikelyAnswer(choice) }) } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) } }}><fieldset><legend>Who’s more likely?</legend><label><input type="radio" name="pick" value="me" checked={choice === 'me'} onChange={() => setChoice('me')} /> You</label><label><input type="radio" name="pick" value="partner" checked={choice === 'partner'} onChange={() => setChoice('partner')} /> Your partner</label></fieldset><button className="conversation-game__primary" type="submit">Save my pick</button></form>}
    </>}
    {gameId === 'lie-detector' && round.status === 'active' && !creatorAnswer && userId === round.creator_id && <form onSubmit={(event) => { event.preventDefault(); try { const result = validateLieDetectorRound(statements, lieIndex); void submit({ lie_index: result.lieIndex }, { statements: result.statements }) } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) } }}><p>Write three statements and mark the one that isn’t true.</p>{statements.map((value, index) => <label key={index}>Statement {index + 1}<input maxLength={280} value={value} onChange={(event) => setStatements((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><input aria-label={`Mark statement ${index + 1} as the lie`} type="radio" name="lie" checked={lieIndex === index} onChange={() => setLieIndex(index)} /></label>)}<button className="conversation-game__primary" type="submit">Share the statements</button></form>}
    {gameId === 'lie-detector' && round.status === 'active' && userId !== round.creator_id && (publicStatements.length === 3 ? <form onSubmit={(event) => { event.preventDefault(); if (guessIndex === null) { setMessage('Choose which statement you think is the lie.'); return } void submit({ guess_index: guessIndex }) }}><fieldset><legend>Which one is the lie?</legend>{publicStatements.map((item, index) => <label key={index}><input type="radio" name="lie-guess" checked={guessIndex === index} onChange={() => setGuessIndex(index)} /> {item}</label>)}</fieldset><button className="conversation-game__primary" type="submit">Lock in my guess</button></form> : <p role="status">Your partner is preparing three statements.</p>)}
    {gameId === 'lie-detector' && round.status === 'active' && userId === round.creator_id && creatorAnswer && <p role="status">Your partner is choosing which statement is the lie.</p>}

    {gameId === 'describe-without-saying-it' && round.status === 'active' && userId === round.creator_id && !creatorAnswer && <div className="conversation-game__clue"><p>Keep the word and forbidden words to yourself. Then pass the phone to your partner.</p>{word ? <><strong>{word.word}</strong>{word.forbidden.length > 0 && <p>Don’t say: {word.forbidden.join(', ')}</p>}<button className="conversation-game__primary" type="button" onClick={() => void submit({})}>Start the 60-second turn</button></> : <button className="conversation-game__primary" type="button" onClick={() => void getDescribeWord(round.id).then(setWord).catch((error) => setMessage(formatSupabaseDataError(error as { message?: string | null })))}>Show me the word</button>}</div>}
    {gameId === 'describe-without-saying-it' && round.status === 'active' && userId !== round.creator_id && (round.public_state?.started ? <form onSubmit={(event) => { event.preventDefault(); try { const guess = validateConversationAnswer(describeGuess); if (guess.length > 80) throw new Error('Guess must be 80 characters or fewer.'); void submit({ guess, correct: false }) } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) } }}><p>Your partner is describing the hidden word. Enter your guess.</p><label>Your guess<input maxLength={80} value={describeGuess} onChange={(event) => setDescribeGuess(event.target.value)} /></label><button className="conversation-game__primary" type="submit">Lock in my guess</button></form> : <p role="status">Your partner is getting ready for the 60-second turn.</p>)}
    {gameId === 'describe-without-saying-it' && round.status === 'active' && userId === round.creator_id && creatorAnswer && <p role="status">Describe your word without using the forbidden words.</p>}

    {rounds.length > 1 && <details className="conversation-game__history"><summary>Earlier round revealed</summary>{rounds.slice(0, -1).map((history) => {
      const creator = history.submissions.find((item) => item.user_id === history.round.creator_id)
      const otherId = history.round.creator_id === session.player_x_id ? session.player_o_id : session.player_x_id
      const guesser = history.submissions.find((item) => item.user_id === otherId)
      const statements = Array.isArray(history.round.public_state?.statements) ? history.round.public_state.statements as string[] : []
      return <section key={history.round.id}><h4>Round {history.round.round_number}</h4>
        {gameId === 'lie-detector' && creator && guesser && (() => { const result = getLieDetectorReveal(statements, Number(creator.answer.lie_index), Number(guesser.answer.guess_index)); return <><ol>{result.statements.map((item, index) => <li key={index}>{item.text}{item.isLie && <strong> · The lie</strong>}</li>)}</ol><p>{result.guessWasCorrect ? 'Your partner found the lie.' : 'Your partner missed the lie.'}</p></> })()}
        {gameId === 'describe-without-saying-it' && creator && <><p>The word was <strong>{String(creator.answer.word)}</strong>.</p>{guesser && <p>Guess: {String(guesser.answer.guess)} · {guesser.answer.correct ? 'Correct!' : 'Not quite'}</p>}</>}
      </section>
    })}</details>}
    {rounds.length > 0 && round.round_number === 2 && !sessionCompleted && <p className="conversation-game__next">Now it’s your partner’s turn to create.</p>}
    {sessionCompleted && <button type="button" className="conversation-game__primary" onClick={onExit}>Back to games</button>}
    {message && <p className="conversation-game__message" role="alert">{message}</p>}
  </section>
}






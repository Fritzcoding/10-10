import { useState } from 'react'
import { acceptDeveloperGameRequest, applyDeveloperMove, createDeveloperPairingState, sendDeveloperGameRequest, type DeveloperPairingState } from '../lib/devPairing'
import './DeveloperPairingHarness.css'

const now = () => new Date()
const accounts = [
  { id: 'dev-5', uid: 5, name: 'Account 5' },
  { id: 'dev-6', uid: 6, name: 'Account 6' },
]

function DeveloperPairingHarness() {
  const [state, setState] = useState<DeveloperPairingState>(createDeveloperPairingState)
  const [activeUserId, setActiveUserId] = useState('dev-5')
  const [message, setMessage] = useState('')
  const pending = state.requests.find((request) => request.status === 'pending' && new Date(request.expires_at) > now())

  const sendRequest = () => {
    setState((current) => sendDeveloperGameRequest(current, 'dev-5', 'dev-6', now()))
    setMessage('Account 5 sent a game request to Account 6.')
  }

  const acceptRequest = () => {
    if (!pending) return
    try {
      setState((current) => acceptDeveloperGameRequest(current, pending.id, 'dev-6', now()))
      setMessage('Account 6 accepted. Both accounts now share the game.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Developer acceptance failed.')
    }
  }

  const move = (index: number) => {
    try {
      setState((current) => applyDeveloperMove(current, activeUserId, index))
      setMessage(`${accounts.find((account) => account.id === activeUserId)?.name} moved.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Move failed.')
    }
  }

  return <main className="dev-harness">
    <header className="dev-harness__header"><div><span className="dev-harness__eyebrow">Local developer mode</span><h1>Two-account pairing lab</h1><p>UID 5 and UID 6 share one simulated request and game.</p></div><span className="dev-harness__badge">No Supabase writes</span></header>
    <section className="dev-harness__accounts" aria-label="Developer accounts">
      {accounts.map((account) => <article className="dev-account" key={account.id}><div><span className="dev-account__uid">UID #{account.uid}</span><h2>{account.name}</h2></div><span className="dev-account__state">{state.session ? 'In shared game' : account.id === 'dev-6' && pending ? 'Game request waiting' : 'Ready'}</span></article>)}
    </section>
    {!state.session && <section className="dev-harness__request" aria-label="Developer request flow"><h2>Request flow</h2><p>{pending ? 'Account 6 has a live request with 60-second expiry.' : 'Start as Account 5, then accept as Account 6.'}</p><div className="dev-harness__actions"><button type="button" onClick={sendRequest} disabled={Boolean(pending)}>Send request from UID 5</button><button type="button" onClick={acceptRequest} disabled={!pending}>Accept as UID 6</button></div></section>}
    {state.session && <section className="dev-harness__game" aria-label="Shared developer game"><div className="dev-harness__game-header"><div><h2>Shared Tic-Tac-Toe</h2><p>Both account panels read this same board.</p></div><div className="dev-harness__turn"><span>Act as</span><select value={activeUserId} onChange={(event) => setActiveUserId(event.target.value)} aria-label="Active developer account">{accounts.map((account) => <option value={account.id} key={account.id}>UID #{account.uid}</option>)}</select></div></div><div className="dev-board" role="grid" aria-label="Shared developer board">{state.session.board.map((mark, index) => <button type="button" role="gridcell" key={index} aria-label={`Square ${index + 1}${mark ? ` ${mark}` : ''}`} onClick={() => move(index)} disabled={Boolean(mark) || state.session?.turn !== (activeUserId === 'dev-5' ? 'X' : 'O')}>{mark ?? '·'}</button>)}</div></section>}
    {message && <p className="dev-harness__message" role="status">{message}</p>}
  </main>
}

export default DeveloperPairingHarness

import { Gamepad2, Settings, UsersRound } from 'lucide-react'

export type HubTab = 'games' | 'friends' | 'settings'

type BottomNavProps = { activeTab: HubTab; onTabChange: (tab: HubTab) => void }

const tabs = [
  { id: 'games' as const, label: 'Games', icon: Gamepad2 },
  { id: 'friends' as const, label: 'Friends', icon: UsersRound },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
]

function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={activeTab === id ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
          aria-current={activeTab === id ? 'page' : undefined}
          onClick={() => onTabChange(id)}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export default BottomNav

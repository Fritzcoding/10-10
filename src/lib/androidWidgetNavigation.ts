export function initialWidgetTab(search: string): 'games' | 'us' {
  return new URLSearchParams(search).has('widget') ? 'us' : 'games'
}

export function shouldScrollToWidgetTarget(target: string | undefined, loading: boolean, coupleId: string): target is string {
  return Boolean(target && !loading && coupleId)
}

export function widgetTargetId(target: string): string {
  if (target === 'plans') return 'calendar'
  if (target === 'voice') return 'note'
  return target
}

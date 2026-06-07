import { useQuery } from '@tanstack/react-query'
import { getSettings } from '#/lib/functions/settings'

export const useSettings = () => {
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })
  return {
    appTitle: settingsQuery.data?.appTitle ?? 'Dockstack',
  }
}

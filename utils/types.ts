export interface Action {
  icon?: 'heart' | 'tag' | 'edit' | 'external' | 'trash' | 'copy' | 'plus' | 'close'
  title: string
  active?: boolean
  variant?: 'default' | 'danger'
  handler?: () => void
}

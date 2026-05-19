export interface Action {
  icon?: 'heart' | 'tag' | 'edit' | 'external' | 'trash' | 'copy' | 'plus' | 'close' | 'link'
  title: string
  active?: boolean
  variant?: 'default' | 'danger'
  handler?: () => void
}

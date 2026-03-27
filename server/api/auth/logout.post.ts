import { logout } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  logout(event)
  
  return {
    success: true
  }
})

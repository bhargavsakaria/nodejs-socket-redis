import connection from '../db-helper'
import { 
  createUser, 
  updateUser, 
  deleteUser, 
  getUsers, 
  createProfile, 
  updateProfile,
  createOrder,
} from '../controller-helpers'

describe('user controller', () => {
  beforeAll(async () => {
    await connection.create()
  })

  beforeEach(async () => {
    await connection.clear()
  })

  afterAll(async () => {
    await connection.close()
  })

  it('should create a new user', async () => {
    const res = await createUser()
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Registered successfully')
  })

  it('should update user', async () => {
    await createUser()
    const res = await updateUser()
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Updated')
  })

  it('should delete user', async () => {
      await createUser()
      const res = await deleteUser('/user/1')
      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Removed')
  })

  it('should get all users', async () => {
      await createUser()
      const res = await getUsers()
      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Success')
  })

  it('should create a new profile for a customer', async () => {
      await createUser()
      const res = await createProfile()
      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Saved profile')
  })

  it('should update profile', async () => {
      await createUser()
      await createProfile()
      const res = await updateProfile(1)
      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Updated')
  })

  it('should create an order', async () => {
    await createUser()
    const res = await createOrder()
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Saved order')
  })
})

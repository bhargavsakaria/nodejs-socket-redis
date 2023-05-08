import request from 'supertest'

import { userForm, userLogin, updateUserInfo, profile, updateProfileForm, order } from './data'
import app from '../src/app'

export const createUser = async () =>
  await request(app).post('/user').send(userForm)

export const loginUser = async () => 
  await request(app).post('/login/local').send(userLogin)

export const updateUser = async () => 
  await request(app).patch('/user').send(updateUserInfo)

export const deleteUser = async (userId: number) => 
  await request(app).delete(`/user/${userId}`)

export const getUsers = async () => 
  await request(app).get('/user/all')

export const createProfile = async () =>
  await request(app).post('/user').send(profile)

export const updateProfile = async (profileId: number) => 
  await request(app)
    .patch(`/user/${profileId}`)
    .send(updateProfileForm)

export const createOrder = async () =>
  await request(app)
    .post('/user/orders')
    .send(order)
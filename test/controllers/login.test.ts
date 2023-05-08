import { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import connection from '../db-helper'
import app from '../../src/app'

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

  // login user with only credentials
  it('should login with email and password', async () => {
    // create user
    await request(app)
      .post('/user')
      .send({
        email: 'abc@gmail.com',
        password: 'password',
      })

      const loginRes = await request(app).post('/login/local').send({
        email: 'abc@gmail.com',
        password: 'password',
      })
      console.log('log in response is ', loginRes.body)
      expect(loginRes.status).toBe(200)
  })

  it('should fail to login with a wrong password', async () => {
    await request(app) 
      .post('/user')
      .send({
        email: 'abc@gmail.com', 
        password: 'password',
        adminPassword: 'asdf'
      })

      const loginRes = await request(app).post('/login/local').send({
        email: 'abc@gmail.com', 
        password: 'assword',
      })
      expect(loginRes.status).toBe(404)
  })
})

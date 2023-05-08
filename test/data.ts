import { isOptionalChain } from "typescript"

export const userForm = {
  email: 'abc@gmail.com',
  password: 'abcdf',
  firstName: 'firstname',
  lastName: 'lastname'
}

export const userLogin = {
  email: userForm.email,
  password: userForm.password,
}

export const updateUserInfo = {
  email: 'updated email',
  password: 'updated password'
}

export const user = {
  email: 'maria@gmail.com',
  password: 'password',
  firstName: 'Maria',
  lastName: 'Magdalena',
  mobileNumber: '12321',
  skypeEmail: 'maria@hotmail.com',
  nursingHome: 'Moonlight',
  department: 'ABC',
  homeAddress: 'Sonnestrasse 6',
  image: 'urlserujkdsshdjfklsdk/aws/buckettoS3',
  isSenior: false,
  isRelative: true,
  isRootUser: false,
}

export const updateProfileForm = {
  update: {
    password: 'word'
  },
  id: 1,
}

export const order = {
  name: 'easy', 
  description: 'all in one',
  price: 60
}


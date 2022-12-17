/* eslint-disable prettier/prettier */
const users = [];

const addUser = (id, name, room) => {
  const existingUser = users.find((user) => user.name.trim().toLowerCase() === name.trim().toLowerCase());

  if (existingUser) return { error: 'Username has already been taken' };
  if (!name && !room) return { error: 'Username and room are required' };
  if (!name) return { error: 'Username is required' };
  if (!room) return { error: 'Room is required' };

  const user = { id, name, room };
  users.push(user);
  return { user };
};

const getUser = (name) => {
  const user = users.find((u) => u.name === name);
  return user;
};

const deleteUser = (id) => {
  const index = users.findIndex((user) => user.id === id);
  if (index !== -1) return users.splice(index, 1)[0];
};

const getUsers = (room) => users.filter((user) => user.room === room);

const getAllUsers = () => users;

module.exports = { addUser, getUser, deleteUser, getUsers, getAllUsers };

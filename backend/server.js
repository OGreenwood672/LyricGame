const express = require("express");
const app = express();
const socket = require("socket.io");
const color = require("colors");
const cors = require("cors");
const { get_Current_User, user_Disconnect, join_User } = require("./dummyuser");

const songs = require('../lyrics/data.json'); 

const { getLyrics } = require('genius-lyrics-api');
const { restart } = require("nodemon");

app.use(express());

const port = 8000;

app.use(cors());

var server = app.listen(
  port,
  console.log(
    `Server is running on the port no: ${(port)} `
      .green
  )
);

const io = socket(server);

const roomLyrics = {}


function newRandomSong(room) {
  playlist = songs.filter(p => p["name"] == "Best")[0];
  let song = playlist.tracks[Math.floor(Math.random() * playlist.tracks.length)];

  const options = {
    apiKey: 'rIcSwWjWpHUZzHYcLhur5189r4jU1_Z94P5YKDTdKg3YZTWYfbXJMd4YkM8wGP-X',
    title: song.name,
    artist: song.artist,
    optimizeQuery: true
  };
  
  
  getLyrics(options).then((lyrics) => {
    if (lyrics == null) {
      newRandomSong(room);
      return;
    }
    roomLyrics[room].song = {
      name: song.name,
      artist: song.artist,
      lyrics: lyrics.split("\n")
    }
  });
}

function sendLyrics(socketid) {

    const p_user = get_Current_User(socketid);

    let song = roomLyrics[p_user.room].song;

    if (song == undefined || song.lyrics.length == 1) {
      console.log("Resetting");
      clearInterval(roomLyrics[p_user.room].interval)
      reset(socketid);
      return;
    }

    song.lyrics[0] += " ";
    while (song.lyrics[0].length == 0 || song.lyrics[0].startsWith("[")) {
      song.lyrics.shift();
      song.lyrics[0] += " ";
    }

    io.to(p_user.room).emit("lyric", {
        text: song.lyrics[0],
    });

    song.lyrics.shift();

}

function reset(socketid) {

  const p_user = get_Current_User(socketid);

  newRandomSong(p_user.room);

  io.to(p_user.room).emit("reset");

  roomLyrics[p_user.room].interval = setInterval(() => sendLyrics(socketid), 5000)

}


//initializing the socket io connection 
io.on("connection", (socket) => {
  //for a new user joining the room
  socket.on("joinRoom", ({ username, roomname }) => {
    //* create user
    const p_user = join_User(socket.id, username, roomname);
    // console.log(socket.id, "=id");
    socket.join(p_user.room);

    //display a welcome message to the user who have joined a room
    socket.emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: `Welcome ${p_user.username}`,
    });

    //displays a joined room message to all other room users except that particular user
    socket.broadcast.to(p_user.room).emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: `${p_user.username} has joined the chat`,
    });
    
    if (!roomLyrics.hasOwnProperty(p_user.room)) {
      roomLyrics[p_user.room] = {};
      newRandomSong(p_user.room);

      setTimeout(() => {
        roomLyrics[p_user.room].interval = setInterval(() => sendLyrics(socket.id), 50)
      }, 5000);
    }
  });

  //user sending message
  socket.on("chat", (text) => {
    //gets the room user and the message sent
    const p_user = get_Current_User(socket.id);

    try {

    songFiltered = (roomLyrics[p_user.room].song.name.split("").filter(letter => {
        n = letter.charCodeAt(0);
        if (n == 32 || (64 < n && n < 91) || (96 < n && n < 123)) {
          return letter;
        }
        return;
      })).join("").toLowerCase();

      console.log(songFiltered);

      if (text.toLowerCase() == songFiltered) {
        io.to(p_user.room).emit("message", {
          userId: p_user.id,
          username: "god",
          text: `${p_user.username} got it`,
        });
        return;

      }
    } catch (e) { console.log(e.message) }

    io.to(p_user.room).emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: text,
    });
  });

  socket.on("start", () => {

    const p_user = get_Current_User(socket.id);

    newRandomSong(p_user.room);

    setInterval(() => sendLyrics(socket.id), 5000);

  })

  

  //when the user exits the room
  socket.on("disconnect", () => {
    //the user is deleted from array of users and a left room message displayed
    const p_user = user_Disconnect(socket.id);

    if (p_user) {
      io.to(p_user.room).emit("message", {
        userId: p_user.id,
        username: p_user.username,
        text: `${p_user.username} has left the chat`,
      });
    }
  });
});
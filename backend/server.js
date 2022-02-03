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

  roomLyrics[room].peopleSucceed = [];

}

function sendLyrics(socketid) {

    const p_user = get_Current_User(socketid);

    let song;

    try {
      song = roomLyrics[p_user.room].song;
    } catch {
      return;
    }

    if (song == undefined || song.lyrics.length == 1) {
      reset(socketid);
      return;
    }

    if (roomLyrics[p_user.room].peopleSucceed.length === roomLyrics[p_user.room].users.length) {
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
  console.log("Resetting");

  const p_user = get_Current_User(socketid);

  clearInterval(roomLyrics[p_user.room].interval)
  roomLyrics[p_user.room].interval = false;

  newRandomSong(p_user.room);

  io.to(p_user.room).emit("reset");

  roomLyrics[p_user.room].interval = setInterval(() => sendLyrics(socketid), 5000);

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
      roomLyrics[p_user.room] = {
        users: [],
        interval: false,
        peopleSucceed: []
      };
    }

    roomLyrics[p_user.room].users.push(p_user.id)

  });

  //user sending message
  socket.on("chat", (text) => {
    //gets the room user and the message sent
    const p_user = get_Current_User(socket.id);

    if (roomLyrics[p_user.room].peopleSucceed.includes(p_user.id)) {

      socket.emit("message", {
        userId: p_user.id,
        username: p_user.username,
        text: `You cannot chat; You've already guessed the song`,
      });

      return;
    }

    if (text.startsWith("/")) {
      text = text.slice(1, text.length);
      if (text == "skip") {
        roomLyrics[p_user.room].peopleSucceed.push(p_user.id);
      } else if (text == "start" && !roomLyrics[p_user.room].interval) {

        console.log(text);
        
        newRandomSong(p_user.room);

        setTimeout(() => {
          roomLyrics[p_user.room].interval = setInterval(() => sendLyrics(socket.id), 5000)
        }, 5000);

      }
      return;
    }

    try {

      songFiltered = (roomLyrics[p_user.room].song.name.split("").filter(letter => {
        n = letter.charCodeAt(0);
        if (n == 32 || (47 < n && n < 57) || (64 < n && n < 91) || (96 < n && n < 123)) {
          return letter;
        }
        return;
      })).join("").toLowerCase();

      console.log(songFiltered);

      if (text.toLowerCase() == songFiltered) {

        io.to(p_user.room).emit("message", {
          userId: p_user.id,
          username: "GOD",
          text: `${p_user.username} got it`,
        });
        roomLyrics[p_user.room].peopleSucceed.push(p_user.id);
        return;

      }
    } catch (e) { console.log(e.message) }

    io.to(p_user.room).emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: text,
    });
  });

  //when the user exits the room
  socket.on("disconnect", () => {
    //the user is deleted from array of users and a left room message displayed
    const p_user = user_Disconnect(socket.id);
    console.log(p_user);

    if (p_user) {

      if (roomLyrics.hasOwnProperty(p_user.room)) {
        try {
          roomLyrics[p_user.room].users.splice(roomLyrics[p_user.room].users.indexOf(p_user.id), 1);
          roomLyrics[p_user.room].peopleSucceed.splice(roomLyrics[p_user.room].peopleSucceed.indexOf(p_user.id), 1);
        } catch (e) {
          console.log(e);
        }

        if (roomLyrics[p_user.room].users.length == 0) {
          clearInterval(roomLyrics[p_user.room].interval);
          delete roomLyrics[p_user.room];
        } else {
          io.to(p_user.room).emit("message", {
            userId: p_user.id,
            username: p_user.username,
            text: `${p_user.username} has left the chat`,
          });
        }

      }
    }
  });
});
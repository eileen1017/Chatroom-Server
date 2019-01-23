// This following code is from 330s wiki
//refrence:The resource page in socket.io,https://github.com/socketio/socket.io/blob/master/examples/chat/index.js

// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.	
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);

//keep track all room information
var rooms = [{'roomName':"Lobby",'existsUsers':[],type:"Public"}];

//keep track all room name
var allroomname = ["Lobby"];

//keep track all username
var usernames = [];

//keep track all blacklist for each room
var blacklist = [];

//keep track of login socket console
var socketInfo=[];

//keep track of all friends name for each user
var friendlist = [];

//join a room
io.on('connection', function(socket){

		//showing the chatting message, modified from the course wiki
		socket.on('message_to_server', function(data) {
			//This callback runs when the server receives a new message from the client.	
			io.sockets.in(socket.room).emit("message_to_client",socket.username,{message:data["message"] }) // broadcast the message to other users
		});

		//sending the private message
		socket.on('private_message_to_server', function(data,toUser) {
			// for each room information check for exists room member in current room
			for (var i = 0; i < rooms.length; i++) {
					if (rooms[i].roomName === socket.room) {
						console.log("Before this is existsUsers:"+Object.values(rooms[i].existsUsers));
						console.log("this is existsUsers:"+rooms[i].existsUsers.indexOf(socket.username));
						//index = (rooms[i].existsUsers).indexOf(socket.username);
						if (rooms[i].existsUsers.indexOf(toUser) >= 0) {
							Object.keys(socketInfo).forEach(function(key) {
    							console.log(key, socketInfo[key]);
    							// find the socket of toUser and send message to his console
    							if (socketInfo[key].username === toUser){
    								console.log("username is: "+socketInfo[key].username);
    								console.log("id is: "+socketInfo[key].id);
    								socket.broadcast.to(socketInfo[key].id).emit("private_message_to_client",socket.username,{message:data["message"]});
    							}

							});
  							
						} else {
							socket.emit("showAlert","The user is not in the room.");
						}
					}
				}
			});

		//sending private message to friends
		socket.on('friend_message_to_server', function(data,toUser) {
			//check toUser is current user's friend or not
			if (showMyFriends().includes(toUser)){
				for (var i = 0; i < rooms.length; i++) {
					// find the socket of toUser and send message to his console
					if (rooms[i].existsUsers.indexOf(toUser) >= 0) {
						Object.keys(socketInfo).forEach(function(key) {
    						console.log(key, socketInfo[key]);
    						if (socketInfo[key].username === toUser){
    							console.log("username is: "+socketInfo[key].username);
   								console.log("id is: "+socketInfo[key].id);
    							socket.broadcast.to(socketInfo[key].id).emit("friend_message_to_client",socket.username,{message:data["message"]});
    						}
						});
					}
  				}
			}
			else {
				socket.emit("showAlert","Please add friend first.");
			}
		});




		//add an user into the chat room 
		socket.on('add_users', function(username){
			if (!usernames.includes(username) && username !== "") {
				socket.emit('updateUser', username);
				// store the username in the socket session for this client
				socket.username = username;
				// store the room name in the socket session for this client
				socket.room = 'Lobby';
				socketInfo.push({username:socket.username,id:socket.id});
				// add the client's username to the global list
				usernames.push(socket.username);

				// update friendlist
				friendlist.push({username:socket.username,friends:[]});

				// send client to room 1
				socket.join(socket.room);

				io.sockets.in(socket.room).emit('showMyFriends', showMyFriends());



				for (var i = 0; i < rooms.length; i++) {
					if (rooms[i].roomName === socket.room) {
						//console.log("this is existsUsers:"+Object.values(rooms[i].existsUsers));
						rooms[i].existsUsers.push(socket.username);
						//console.log("this is existsUsers:"+Object.values(rooms[i].existsUsers));
						io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
					}
				}
				// echo to client they've connected
				socket.emit('update_chat', username, 'you have connected to '+socket.room);


				// echo to room 1 that a person has connected to their room
				socket.broadcast.to(socket.room).emit('update_chat', username, ' has connected to this room');
				//socket.emit('updaterooms', rooms, 'Lobby');
				socket.emit('updateRoom', socket.room, "success");
				socket.emit('displayRoom',rooms,socket.room);
			} else {
				socket.emit('relogin','Please choose another username.');
			}
		});

		//make another room and the romm is private
		socket.on("addPrivateRoom", function(roomName,password) {
			if (!allroomname.includes(roomName)){
				rooms.push({roomName: roomName, existsUsers:[],password: password, creator: socket.username, type: "Private"});
				allroomname.push(roomName);
				//console.log(rooms);
				io.emit('displayRoom',rooms,socket.room);
			} else {
				socket.emit('showAlert','Please enter a different roomName.');
			}

		});

		//make another room and the romm is public
		socket.on("addPublicRoom", function(roomName) {
			if (!allroomname.includes(roomName)){
				rooms.push({roomName: roomName,existsUsers:[], creator: socket.username, type: "Public"});
				allroomname.push(roomName);
				//console.log(rooms);
				io.emit('displayRoom',rooms,socket.room);}
			else {
				socket.emit('showAlert','Please enter a different roomName.');
			}

		});

		//switch to another room and the room is private
		socket.on("switchPrivateRoom", function(selectRoom,pwd,password) {
			if (pwd === password && socket.room !== selectRoom && !checkForBlacklist(selectRoom,socket.username)) {
				socket.broadcast.to(socket.room).emit('update_chat', socket.username, ' has left this room');
				console.log("sssssssss");
				for (var i = 0; i < rooms.length; i++) {
					if (rooms[i].roomName === socket.room) {
						console.log("Before this is existsUsers:"+Object.values(rooms[i].existsUsers));
						console.log("this is existsUsers:"+rooms[i].existsUsers.indexOf(socket.username));
						//index = (rooms[i].existsUsers).indexOf(socket.username);
						if (rooms[i].existsUsers.indexOf(socket.username) > -1) {
  							rooms[i].existsUsers.splice(rooms[i].existsUsers.indexOf(socket.username), 1);
  							io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
						}
						//delete rooms[i].existsUsers[socket.username];
						console.log("After this is existsUsers:"+Object.values(rooms[i].existsUsers));

					}
				}
				console.log("eeeeeeee");
				socket.leave(socket.room);
				socket.room = selectRoom;
				//console.log("this is private room number:"+ socket.room);
				socket.join(socket.room);

				for (var i = 0; i < rooms.length; i++) {
					if (rooms[i].roomName === socket.room) {
						console.log("Before this is existsUsers:"+Object.values(rooms[i].existsUsers));
						//console.log("this is existsUsers:"+rooms[i].existsUsers.indexOf(socket.username));
						//index = (rooms[i].existsUsers).indexOf(socket.username);
						rooms[i].existsUsers.push(socket.username);
						io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
						//delete rooms[i].existsUsers[socket.username];
						console.log("After this is existsUsers:"+Object.values(rooms[i].existsUsers));

					}
				}
				socket.broadcast.to(socket.room).emit('update_chat', socket.username, ' has joined this room ' + socket.room);
				io.sockets.in(socket.room).emit('user_here', usernames);
				socket.emit('updateRoom', socket.room, "success");

				socket.emit('displayRoom',rooms,socket.room);

			} else {
				if (pwd !== password){
					socket.emit('showAlert','Please check your password');
				} else if (checkForBlacklist(selectRoom,socket.username)){
					socket.emit('showAlert','Sorry, You are banned from ' +selectRoom+' .')
				} else {
					io.emit('updateRoom',socket.room,"fail");
				}
			}
			
		});


		// swicth to another room and the room is public
		socket.on("switchPublicRoom", function(selectRoom) {
			if (socket.room !== selectRoom && !checkForBlacklist(selectRoom,socket.username)) {
				socket.broadcast.to(socket.room).emit('update_chat', socket.username , ' has left this room');

				for (var i = 0; i < rooms.length; i++) {
					if (rooms[i].roomName === socket.room) {
						if (rooms[i].existsUsers.indexOf(socket.username) > -1) {
  							rooms[i].existsUsers.splice(rooms[i].existsUsers.indexOf(socket.username), 1);
  							io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
						}

					}
				}

				socket.leave(socket.room);
				socket.room = selectRoom;
				//console.log("this is public room number:"+ socket.room);
				socket.join(socket.room);

				for (var i = 0; i < rooms.length; i++) {
					if (rooms[i].roomName === socket.room) {
						
						rooms[i].existsUsers.push(socket.username);
						io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
						

					}
				}
				
				//socket.broadcast.to(socket.room).emit('update_chat', socket.username, ' has joined this room ' + socket.room);
				io.sockets.in(socket.room).emit('user_here', usernames);

				socket.emit('updateRoom', socket.room, "success");
				socket.emit('update_chat', socket.username, 'you have connected to '+socket.room);
				//console.log("this is rooms:"+ rooms);
				socket.emit('displayRoom',rooms,socket.room);}
				else{
					if (checkForBlacklist(selectRoom,socket.username)){
						socket.emit('showAlert','Sorry, You are banned from ' +selectRoom+' .')
					} else {
						io.emit('updateRoom',socket.room,"fail");
					}
				}
			
		});



	//kicking someone out of the current chat room
	socket.on("kick", function(kick_person,roomName){

		var found = false;

		// check user is the creator of currentroom or not
		for(var i = 0; i < rooms.length; i++) {
			console.log("this is input: "+ kick_person +" "+roomName);
			console.log("this is creator: "+rooms[i].creator);
			console.log("this is roomName: "+rooms[i].roomName);
    		if (rooms[i].creator === socket.username && rooms[i].roomName === roomName) {

        	found = true;
       
        	break;
    		}
		}

		//if yes, check kick_person is in the room or not. if yes, kick the person to Lobby
		if (found === true) {

				Object.keys(socketInfo).forEach(function(key) {
    							console.log(key, socketInfo[key]);
    							if (socketInfo[key].username === kick_person){
    								
    								let socket = io.sockets.connected[socketInfo[key].id];
    								socket.leave(socket.room);
    								for (var i = 0; i < rooms.length; i++) {
    									if (rooms[i].existsUsers.indexOf(kick_person) > -1) {
  										rooms[i].existsUsers.splice(rooms[i].existsUsers.indexOf(kick_person), 1);
  										io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );

										}

					
    								}
    								//kick to lobby
    								socket.room = 'Lobby';
    								socket.join('Lobby');

    								//update room information
    								for (var i = 0; i < rooms.length; i++) {
										if (rooms[i].roomName === 'Lobby') {
											rooms[i].existsUsers.push(kick_person);

											socket.emit('updateRoom', 'Lobby', "success");
											io.sockets.in('Lobby').emit('users_here', Object.values(rooms[i].existsUsers) );

										}
									}

									//broadcasting
    								socket.broadcast.to(roomName).emit('update_chat', kick_person, ' was kicked out.');
    								io.sockets.connected[socketInfo[key].id].emit("update_chat","You",'are kicked out from '+roomName+' and enters in Lobby.');
    								socket.broadcast.to(socketInfo[key].id).emit("updateRoom",'Lobby','success');
    								socket.broadcast.to("Lobby").emit("update_chat",socket.username,' enters Lobby.');
    						
    						}

						});

			} else {
				socket.emit('showAlert','You do not have the authorization to kick people.');
			}

	});

	

	//  ban someone in the chatting room
	socket.on("ban", function(person_no,currentRoom){
		var found = false;

		// check user is the creator of currentroom or not
		for(var i = 0; i < rooms.length; i++) {
    		if (rooms[i].creator === socket.username && rooms[i].roomName === socket.room) {

        	found = true;
       
        	break;
    	}
		}

		//if yes do following
		if (found === true) {
			Object.keys(socketInfo).forEach(function(key) {
				if (socketInfo[key].username === person_no){
    				console.log(key, socketInfo[key]);
    				let socket = io.sockets.connected[socketInfo[key].id];
    				// check if ban person in the currentroom or not, if yes, kick out to lobby
    				if (checkExistenceOfUser(currentRoom,person_no)) {
    					for (var i = 0; i < rooms.length; i++) {
    					if (rooms[i].existsUsers.indexOf(person_no) > -1) {
  							rooms[i].existsUsers.splice(rooms[i].existsUsers.indexOf(person_no), 1);
  							io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
						}
					}
					socket.broadcast.to(currentRoom).emit('update_chat', socket.username, ' has banned in this room');
					blacklist.push({roomName:currentRoom, bannedlist:{person_no}});
					socket.leave(socket.room);
					//kick out to lobby
					socket.room = 'Lobby';
    				socket.join('Lobby');

    				//update room info
    				for (var i = 0; i < rooms.length; i++) {
						if (rooms[i].roomName === 'Lobby') {
							rooms[i].existsUsers.push(person_no);
							socket.emit('updateRoom', 'Lobby', "success");
							io.sockets.in('Lobby').emit('users_here', Object.values(rooms[i].existsUsers) );
							socket.broadcast.to("Lobby").emit('update_chat', socket.username, ' enters the Lobby');
						}
					}
				} else {
					//if not in the room, just update the blacklist and broadcast to the user

					for (var i = 0; i < rooms.length; i++) {
    					if (rooms[i].existsUsers.indexOf(person_no) > -1) {
  							rooms[i].existsUsers.splice(rooms[i].existsUsers.indexOf(person_no), 1);
  							io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
  							socket.emit('updateRoom', socket.room, "success");
						}
					}
					socket.broadcast.to(currentRoom).emit('update_chat', socket.username, ' has banned in this room');
					blacklist.push({roomName:currentRoom, bannedlist:{person_no}});

				}
				io.sockets.connected[socketInfo[key].id].emit("update_chat","You",'are banned from '+currentRoom);
				}
			});
		} else {
			socket.emit('showAlert','You do not have the authorization to ban people.');
		}

	});

	//add friend to friendlist
	socket.on("addFriend", function(friendname) {
			//check if friends exits and user not adding themself
			if (usernames.includes(friendname) && friendname !== socket.username){
				for (var i = 0; i < friendlist.length; i++) {
					//update user's friendlist
					if (friendlist[i].username === socket.username && !friendlist[i].friends.includes(friendname)){
					friendlist[i].friends.push(friendname);
					socket.emit('showAlert','You have successfully added '+friendname);
					}
					//update friend's friendlist
					if (friendlist[i].username === friendname && !friendlist[i].friends.includes(socket.username) ){
						friendlist[i].friends.push(socket.username);
					}
				}
				socket.emit('showMyFriends',showMyFriends());
			} else {
				// check exits of user, show alert message
				if (!usernames.includes(friendname)) {
					socket.emit('showAlert',friendname +' does not exit.');
				} 
				//if user add themself, show alert
				else if (friendname === socket.username) {
					socket.emit('showAlert','You cannot add yourself. Please choose a different friend.');
				}
				//other false outcomes
				else {
					socket.emit('showAlert','Please choose a different friend.');
				}
			}

		});


	// delete a friend doublesided
	socket.on('deleteFriend',function(friendname){
		if (usernames.includes(friendname)) {
			for (var i = 0; i < friendlist.length; i++) {
				if (friendlist[i].username === socket.username && friendlist[i].friends.indexOf(friendname) > -1){
					friendlist[i].friends.splice(friendlist[i].friends.indexOf(friendname), 1);
					socket.emit('showAlert','You have successfully deleted ' + friendname);
				}
				if (friendlist[i].username === friendname && friendlist[i].friends.indexOf(socket.username) > -1){
					friendlist[i].friends.splice(friendlist[i].friends.indexOf(socket.username), 1);
				}
			}
			socket.emit('showMyFriends',showMyFriends());
		} else {
			socket.emit('showAlert',friendname +' does not exit.');
		}

	});


	//request for show friends
	socket.on('showMyFriends', function(){
		socket.emit('showMyFriends',showMyFriends());
	});

	//helper function to check friendlist of current user
	function showMyFriends(){
		for (var i = 0; i < friendlist.length; i++) {
			if (friendlist[i].username === socket.username){
				return Object.values(friendlist[i].friends);
			}
		}
	}

	//check a person in blacklist or not
	function checkForBlacklist(roomName,user){
		//console.log(checkForBlacklist(socket.room,person_no));
		for (var i = 0; i < blacklist.length; i++) {

    		if (blacklist[i].roomName.indexOf(roomName) > -1 && Object.values(blacklist[i].bannedlist).includes(user)) {
    			return true;
				}
					
    		}
	}

	//check a user inside the room or not
	function checkExistenceOfUser(roomName,user){
		for (var i = 0; i < rooms.length; i++) {
			if (rooms[i].roomName === roomName) {
				if (Object.values(rooms[i].existsUsers).indexOf(user) > -1) {
					return true;
				}
				

			}
		}
	}
	

	// sending files and images
	//reference: https://stackoverflow.com/questions/34850386/socket-io-chat-app-that-can-also-send-image-and-even-file

	socket.on('user_image', function (msg) {
        //Received an image: broadcast to all
        io.sockets.in(socket.room).emit('user_image', socket.username, msg);
    });


	// when the user disconnects.. perform this
	socket.on('disconnect', function(){
		console.log("logout user: "+socket.username);
		for (var i = 0; i < rooms.length; i++) {
    		if (rooms[i].existsUsers.indexOf(socket.username) > -1) {
  				rooms[i].existsUsers.splice(rooms[i].existsUsers.indexOf(socket.username), 1);
  				io.sockets.in(socket.room).emit('users_here', Object.values(rooms[i].existsUsers) );
				}
			}
			console.log("logout user: "+socket.username);
		socket.broadcast.emit('update_chat', socket.username, ' has disconnected');
		var index = usernames.indexOf(socket.username);
		if (index > -1) {
  			usernames.splice(index, 1);
		}
		console.log("logout user: "+socket.username);
		console.log("this is usernames after logout: "+ usernames);
		socket.leave(socket.room);
		
	});





});




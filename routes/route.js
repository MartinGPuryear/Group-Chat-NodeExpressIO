module.exports = function Route(app)
{
  var num_users = {};
  var room_msgs = {};

//  Worker functions

  //    Is this session already active?  
  function session_already_connected(request)
    {
      if (request.session.connect_count > 1)
      {
        console.log('new_user_requested.  Already logged in and connect_count incremented, so doing nothing else....'); 
        return true;
      }
      return false;
    }

  //    Validate the name/room that the client sent.  
    //  Don't let malformed request.data crash us.
    //  Name and Room can both be any combination of
    //  characters, but neither can be blank (after
    //  being trimmed). If blank, EMIT error_new_user 
    //  to notify client to resend compliant info.
  function validate_inputs(request)
    {
      if (!request.data)
      {
        return false;
      }

      if (request.data.user_name)
      {
        request.data.user_name = request.data.user_name.trim();
      }
      if (!request.data.user_name)
      {
        console.log('EMIT: error_new_user - !name'); 
        request.io.emit('error_new_user', "Name is required");
        return false;
      }

      if (request.data.room)
      {
        request.data.room = request.data.room.trim();
      }
      if (!request.data.room)
      {
        console.log('EMIT: error_new_user - room =', request.data.room); 
        request.io.emit('error_new_user', "Room cannot be blank");
        return false;
      }
      return true;
    }

//  Routing functions

  //    RECEIVE 'client_ready' upon initial client connect.
    //  Define session connect_count if needed, then increment.
  app.io.route('client_ready', function(request)
    {
        //  convert to 0, if undefined
      request.session.connect_count = request.session.connect_count || 0;   
      request.session.connect_count++;
    });

  //    RECEIVE 'new_user_requested' when client send name/room.
    //  Return immediately if already connected or malformed data.
    //  Save name/room to the session; increment num_users for this
    //  room; join client to the room; create a msg that this client
    //  joined the room; push the msg to the room's msg queue; 
    //  BROADCAST(room) this msg to others in the room; EMIT back
    //  to the client the list of all msgs to this room (including
    //  this "new client has joined" one)
  app.io.route('new_user_requested', function(request)
    {
      if (session_already_connected(request) || !validate_inputs(request))
      {
        return;         //  error msg already emitted back to client
      }
      request.session.user_name = request.data.user_name;      
      request.session.room = request.data.room;
      num_users[request.session.room] = num_users[request.session.room] || 0;
      num_users[request.session.room]++;

      console.log('Logged in user is ' + request.session.user_name + ', num_users[' + request.session.room + '] is now: ' + num_users[request.session.room] );
      request.io.join(request.session.room);
      msg = { user_name: request.session.user_name, message: 'has joined the room '+request.session.room+' conversation.' };
      
      room_msgs[request.session.room] = room_msgs[request.session.room] || [];
      room_msgs[request.session.room].push( msg );

      request.io.room(request.session.room).broadcast('new_user_arrived', msg )
      request.io.emit('state_of_the_world', { all_messages: room_msgs[request.session.room] });
    });

  //    RECEIVE 'posting_new_msg' when client emits new chat msg.
    //  Validate inputs (even a ill-intentioned client should 
    //  never be able to crash the server).  Trim the msg; if it
    //  is non-blank(!), push it to the room's message queue and
    //  BROADCAST(room) 'new_msg_arrived' with the new message.
  app.io.route('posting_new_msg', function(request)
    {
      if (!request.data || !request.data.json_msg || !request.data.json_msg.message)
      {
        return;
      }

      var msg = request.data.json_msg.message.trim();
      if (msg)
      { 
        var name = request.session.user_name;
        room_msgs[request.session.room].push( { user_name: name, message: msg });

        request.io.room(request.session.room).broadcast('new_msg_arrived', { user_name: name, message: msg } );
      }
    });

  //    RECEIVE 'disconnect' when the browser session terminates.
    //  Triggered by user refresh or close-tab/close-window. 
    //  Check for undefined session variables (occurs for clients
    //  that are connected during a server reboot): just exit.
    //  Decrement connect_count; do nothing else if client still
    //  has another connection (if connect_count is still > 0).
    //  Decrement num_users[room] and detach user from the room.
    //  If the room is now empty, clear the message queue. Else,
    //  create a 'user departed' msg and BROADCAST(room) it. 
    //  Clear out the session struct before leaving altogether.
  app.io.route('disconnect', function(request)
    {      
      if (  !request.session      || !request.session.user_name 
         || !request.session.room || !request.session.connect_count )
      {
        console.log("disconnect with undefined session/name/room/connect_count");
        return;
      }

      request.session.connect_count--;
      if (request.session.connect_count > 1)
      {
        console.log('disconnect, but session still has connect_count');
        return;
      }
      num_users[request.session.room]--;
      
      request.io.leave(request.session.room);
      console.log(request.session.user_name + ' has left the conversation, and num_users[' + request.session.room + '] is now: ' + num_users[request.session.room] );
      if (num_users[request.session.room] > 0)
      {
        var msg = { user_name: request.session.user_name, message: 'has left the conversation'};
        room_msgs[request.session.room].push( msg );

        request.io.room(request.session.room).broadcast('user_disconnected', { user_name: request.session.user_name, message: 'has left the conversation' } );
      }
      else
      {
          room_msgs[request.session.room] = null;
          num_users[request.session.room] = null;
      }

      request.session = null;
    });

  //    GET '/': render the simple view. 
  app.get('/', function(request, response)
    {
      response.render('index', { title:'Group Chat' });
    });

  //    GET '/index' equates to the root; redirect there.
  app.get('/index', function(request, response)
    {
      response.redirect('/');      
    });

}

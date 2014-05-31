module.exports = function Route(app)
{
  var num_users = {};
  var room_msgs = {};

  function session_already_connected(request)
    {
      if (request.session.connect_count > 1)
      {
        console.log('new_user_requested.  Already logged in and connect_count incremented, so doing nothing else....'); 
        return true;
      }
      return false;
    }

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

  app.io.route('ready', function(request)
    {
      request.session.connect_count = request.session.connect_count || 0;   //  convert to 0, if undefined
      request.session.connect_count++;
    });

  app.io.route('new_user_requested', function(request)
    {
      if (session_already_connected(request) || !validate_inputs(request))
      {
        return;         //  error msg already emitted back to client
      }
      request.session.user_name = request.data.user_name;
      console.log('Logged in user is ' + request.session.user_name + ', num_users[' + request.session.room + '] is now: ' + num_users[request.session.room] );
      
      request.session.room = request.data.room;
      num_users[request.session.room] = num_users[request.session.room] || 0;
      num_users[request.session.room]++;

      request.io.join(request.session.room);
      msg = { user_name: request.session.user_name, message: 'has joined the room '+request.session.room+' conversation.' };
      
      room_msgs[request.session.room] = room_msgs[request.session.room] || [];
      room_msgs[request.session.room].push( msg );

      request.io.room(request.session.room).broadcast('new_user_arrived', msg )
      request.io.emit('state_of_the_world', { all_messages: room_msgs[request.session.room] });
    });

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

  app.io.route('disconnect', function(request)
    {      
      request.session.connect_count--;
      if (request.session.connect_count > 1)
      {
        console.log('disconnect, but this session still has a connect_count');
        return;
      }

      if (request.session.user_name === undefined)
      {
        console.log("disconnect, undefined name");
        return;
      }
      num_users[request.session.room]--;
      
      request.io.leave(request.session.room);
      console.log(request.session.user_name + ' has left the conversation, and num_users[' + request.session.room + '] is now: ' + num_users[request.session.room] );
      if (num_users[request.session.room] == 0)
      {
          room_msgs[request.session.room] = null;
      }
      else
      {
        var msg = { user_name: request.session.user_name, message: 'has left the conversation'};
        room_msgs[request.session.room].push( msg );

        request.io.room(request.session.room).broadcast('user_disconnected', { user_name: request.session.user_name, message: 'has left the conversation' } );
      }

      request.session.connect_count = 0;
      request.session.room = null;
      request.session.user_name = null;
    });

  app.get('/', function(request, response)
    {
      response.render('index', { title:'Group Chat' });
    });

  app.get('/index', function(request, response)
    {
      response.redirect('/');      
    });

}

module.exports = function Route(app)
{
  MIN_ROOM = 1;
  MAX_ROOM = 4;

  var num_users = 0;
  var all_msgs = [];

  for (var room = MAX_ROOM; room >= MIN_ROOM; room--) 
  {
    all_msgs[room] = [];
  }

  app.io.route('ready', function(request)
    {
      request.session.connect_count = request.session.connect_count || 0;   //  convert to 0, if undefined
      request.session.connect_count++;
    });

  app.io.route('new_user_requested', function(request)
    {
      if (request.session.connect_count > 1)
      {
        console.log('new_user_requested.  Already logged in, so incrementing connect_count and returning....'); 
        return;
      }

      if (!request.data.user_name)
      {
        console.log('EMIT: error_new_user - !name'); 
        request.io.emit('error_new_user', "Name is required");
        return;
      }

      var room = parseInt(request.data.room);
      if ((room < MIN_ROOM) || (room > MAX_ROOM) || (isNaN(room)))
      {
        console.log('EMIT: error_new_user - room =', room); 
        request.io.emit('error_new_user', "Room (" + room + ") must be a number between " + MIN_ROOM + " and " + MAX_ROOM);
        return;
      }
      request.session.room = room;
      num_users++;
      request.session.user_name = request.data.user_name;
      console.log('Logged in user is ' + request.session.user_name + ', num_users is now', num_users);
      
      request.io.join(request.session.room);
      msg = { user_name: request.session.user_name, message: 'has joined the room '+request.session.room+' conversation.' };
      all_msgs[request.session.room].push( msg );

      request.io.room(request.session.room).broadcast('new_user_arrived', msg )
      request.io.emit('state_of_the_world', { all_messages: all_msgs[request.session.room] });
    });

  app.io.route('posting_new_msg', function(request)
    {
      var msg = request.data.json_msg.message;
      if (msg)
      { 
        var name = request.session.user_name;
        all_msgs[request.session.room].push( { user_name: name, message: msg });

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
      num_users--;
      
      request.io.leave(request.session.room);
      console.log(request.session.user_name + ' has left the conversation, and num_users is now: ', num_users );
      if (num_users == 0)
      {
          all_msgs[request.session.room] = [];
      }
      else
      {
        var msg = { user_name: request.session.user_name, message: 'has left the conversation'};
        all_msgs[request.session.room].push( msg );

        request.io.room(request.session.room).broadcast('user_disconnected', { user_name: request.session.user_name, message: 'has left the conversation' } );
      }

      request.session.room = null;
      request.session.user_name = null;
      request.session.connect_count = 0;
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

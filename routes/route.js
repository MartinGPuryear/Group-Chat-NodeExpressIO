module.exports = function Route(app)
{
  var num_users = 0;
  var all_msgs = [];
  all_msgs[0] = [];
  all_msgs[1] = [];
  all_msgs[2] = [];
  

  app.io.route('ready',      function(request) 
    { 
      console.log('RECEIVED: ready'); 
    });

  app.io.route('new_user_requested', function(request)
    {
      console.log('RECEIVED: new_user_requested'); 

      if (!request.data.user_name)
      {
        request.io.emit('error_new_user', "Name is required");
        console.log('EMIT: error_new_user'); 
        return;
      }
      else
      {
        num_users++;
        request.session.user_name = request.data.user_name;
        console.log('Logged in user is: ', request.session.user_name, ', num_users is now ', num_users);
        
        if (request.data.user_name == "Martin") 
        {
          request.session.room = 2;
          msg = { user_name: request.session.user_name, message: 'has joined the room 2 conversation' };
          request.io.join(1);
        } 
        else
        {
          msg = { user_name: request.session.user_name, message: 'has joined the room 1 conversation' };
          request.session.room = 1;
        }
        request.io.join(request.session.room);

        all_msgs[request.session.room].push( msg );


        request.io.room(request.session.room).broadcast('new_user_arrived', msg )
        console.log('BROADCAST: new_user_arrived'); 

        request.io.emit('state_of_the_world', { all_messages: all_msgs[request.session.room] });
        console.log('EMIT: state_of_the_world'); 
      }
    });

  app.io.route('posting_new_msg', function(request) 
    {
      console.log('RECEIVED: posting_new_msg: ', request.data.json_msg.message); 
      var msg = request.data.json_msg.message;
      if (msg)
      { 
        var name = request.session.user_name;
        all_msgs[request.session.room].push( { user_name: name, message: msg });
        console.log(all_msgs[request.session.room]);

        request.io.room(request.session.room).broadcast('new_msg_arrived', { user_name: name, message: msg } )
        console.log('BROADCAST: new_msg_arrived'); 
      }
    });

  app.io.route('disconnect', function(request) 
    {
      console.log("RECEIVED: disconnect (" + request.session.user_name + ")");
      if (request.session.user_name === undefined)
      { 
        return;
      }
      num_users--;
      
      request.io.leave(1);
      console.log(request.session.user_name, ' has left the conversation, and num_users is now: ', num_users );
      if (num_users == 0)
      {
        all_msgs[request.session.room] = [];
        return;
      }
      var msg = { user_name: request.session.user_name, message: 'has left the conversation'};
      all_msgs[request.session.room].push( msg );

      request.io.room(request.session.room).broadcast('user_disconnected', { user_name: request.session.user_name, message: 'has left the conversation' } );
      console.log("BROADCAST: user_disconnected (" + request.session.user_name + ")");
    });

  app.get('/', function(request, response)
    {
      response.render('index', { title:'Group Chat' });
    });

  app.get('/index', function(request, response)
    {
      response.redirect('/');      
    };

}


//    Main page for group_chat application, but really 
  //  just loads other modules.  Most of the server-
  //  side code for this application is in route.js.

var express = require('express.io');
var path = require('path');
var app = express().http().io();
var port = 6789;

    //    configure our environment
app.configure(function()
  {
    app.use(express.cookieParser());  

    //    handle POST data
    app.use(express.urlencoded());
    app.use(express.json());

    //    handle static contents
    app.use(express.static(path.join(__dirname, 'public')));

    //    sessions support enabled.
    app.use(express.session({secret: 'peach'}));

    app.set('view engine', 'ejs');
  });

  //    /routes/index.js handles all routing
var route = require('./routes/route.js')(app);
app.listen(port);

console.log('\n ***************************************************');
console.log('*****                                           *****');
console.log('*****   Express server listening on port ' + port + '   *****');
console.log('*****                                           *****');
console.log(' ***************************************************\n');

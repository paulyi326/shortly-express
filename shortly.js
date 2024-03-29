var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt = require('bcrypt-nodejs');

var app = express();
app.use(express.cookieParser('secret'));
app.use(express.session());

var restrict = function(req, res, next){
  if(req.session.user){
    next();
  } else {
    res.redirect('/login');
  }
};

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser())
  app.use(express.static(__dirname + '/public'));
});

app.get('/signup',function(req,res){
  res.render('signup');
});

app.get('/login',function(req,res){
  res.render('login');
});

app.post('/signup',function(req,res){

  var uname = req.body.username;
  var pwd = req.body.password;

  new User({username: uname}).fetch().then(function(found){
    if(found) {
      console.log("User already has signed up, redirecting");
      res.redirect('/login');
    } else {
      User.forge({username: uname, password: pwd}).save().then(function(newUser){
        Users.add(newUser);
        res.send(200, newUser);
      });
    }
  });
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;


  new User({username: username}).fetch().then(function(found) {
    if (found) {
      console.log("Login Credentials exist");

      var salt = found.attributes.salt;
      var loginPwd = bcrypt.hashSync(password,salt);

      if(loginPwd === found.attributes.password){
        req.session.regenerate(function() {
          req.session.user = username;
          res.redirect('/');
        });
      } else {
        res.redirect('/login');
        console.log("Incorrect Password");
      }
    } else {
      console.log("User not found");
    }
  });
});

app.get('/', restrict, function(req, res) {
  console.log("User session active and logged in");
  res.render('index');
});

app.get('/create', function(req, res) {
  res.render('index');
});

app.get('/links', function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/logout',function(req,res){
  setTimeout(function(){
      req.session.destroy(function(){
        res.redirect('/');
      });
    },100);
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

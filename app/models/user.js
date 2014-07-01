var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  initialize: function(arg) {
    this.on('creating', function(model, attrs, options) {
      //generate salt, generate hashedpwd from salt and save both
      var salt = bcrypt.genSaltSync(10);
      var hashPassword = bcrypt.hashSync(arg.password,salt);

      model.set('username', arg.username);
      model.set('password', hashPassword);
      model.set('salt',salt);
    });
  }
});

module.exports = User;

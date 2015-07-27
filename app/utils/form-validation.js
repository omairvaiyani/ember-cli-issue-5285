export default

{
    name: function (name) {
        if (!name || !name.length || (name.split(' ').length < 2))
            return false;
        else
            return true;
    },

    email: function (email) {
        var atpos = email.indexOf("@");
        var dotpos = email.lastIndexOf(".");
        if (atpos < 1 || dotpos < atpos + 2 || dotpos + 2 >= email.length) {
            return false;
        } else {
            return true;
        }
    },

    password: function(password) {
        if (!password || !password.length || (password.length < 6))
            return false;
        else
            return true;
    },

    // @Deprecated
    confirmPassword: function(password, confirmPassword) {
        if(password !== confirmPassword)
            return false;
        else
            return true;
    }
}

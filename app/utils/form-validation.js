export default

{
    /**
     * @Function Name
     * @param {string} name
     * @returns {String|Boolean} if false, no error, else message.
     */
    name: function (name) {
        if(!name || !name.length)
            return "Please enter your name!";
        else if (name.split(' ').length < 2)
            return "Please enter your full name!";
        else
            return false;
    },

    /**
     * @Function Email
     * @param {string} Email
     * @returns {String|Boolean} if false, no error, else message.
     */
    email: function (email) {
        if(!email || !email.length)
            return "Please enter you email!";

        var atpos = email.indexOf("@");
        var dotpos = email.lastIndexOf(".");
        if (atpos < 1 || dotpos < atpos + 2 || dotpos + 2 >= email.length) {
            return "This email is not valid!";
        } else {
            return false;
        }
    },

    /**
     * @Function Password
     * @param {string} password
     * @returns {String|Boolean} if false, no error, else message.
     */
    password: function(password) {
        if (!password || !password.length)
            return "Please enter your password!";
        else if (password.length < 6)
            return "This password is too short! (min 6 characters)";
        else
            return false;
    }
}

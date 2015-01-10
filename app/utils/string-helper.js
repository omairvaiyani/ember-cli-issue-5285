if (typeof String.prototype.startsWith != 'function') {
    // see below for better implementation!
    String.prototype.startsWith = function (str){
        return this.indexOf(str) == 0;
    };
}

export default {
    upperCaseFirst: function(string) {
        return string.charAt(0).toUpperCase() + string.substr(1);
    }
}

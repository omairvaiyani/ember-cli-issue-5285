import Ember from 'ember';

function timeAmPm(time24hr) {
    time24hr = parseInt(time24hr.slice(0, 2));
    var time = time24hr > 12 ? (time24hr - 12) + "pm" : time24hr + "am";
    if(time === "0am")
        time = "12am";
    return time;
}

export {
    timeAmPm
    };

export default Ember.Handlebars.makeBoundHelper(timeAmPm);

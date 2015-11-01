import Ember from 'ember';
import {MAP_TYPES} from 'ember-google-map/components/google-map';

export default Ember.Controller.extend({
    lat: 53.807327,
    lng: -1.560215,
    zoom: 18,
    type: 'satellite',
    mapTypes: MAP_TYPES,
    infoWindows: [
        {
            title: 'Synap', lat: 53.807327, lng: -1.560215, description: "Synap Office"
        }
    ]
});

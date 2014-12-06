import Ember from 'ember';
import {MAP_TYPES} from 'ember-google-map/components/google-map';

export default Ember.Controller.extend({
    lat: 53.807327,
    lng: -1.560215,
    zoom: 18,
    type: 'satellite',
    mapTypes: MAP_TYPES,
    /*markers:     [
     {title: 'MyCQs', lat: 53.807327, lng: -1.560215, description: 'Leeds Innovation Center', isDraggable: false}
     ],*/
    infoWindows: [
        {
            title: 'MyCQs', lat: 53.807327, lng: -1.560215, description: 'MyCQs Office'
            //addressLine1: "InTechnology Enterprise Incubation Program",
            //addressLine2: "Suite 11b Leeds Innovation Centre",
            //addressLine3: "103 Clarendon Road",
            //city: "Leeds"
            //postcode: "LS2 9DF",
            //country: "United Kingdom"
        }
    ]
});

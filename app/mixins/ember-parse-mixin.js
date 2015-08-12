import Ember from 'ember';

export default Ember.Mixin.create({
    primaryKey: 'objectId',
    //objectId: DS.attr('string'),
    createdAt: DS.attr('date'),
    updatedAt: DS.attr('date'),

    /**
     * @Deprecated
     *
     *
     * @param recordType
     * @param property
     * @param parentRecord
     * @returns {*}
     */
    getIncludedProperty: function (recordType, property, parentRecord) {
        if(!parentRecord)
            return this.get('_data.'+recordType+"."+property);
        else {
            return this.get('_data.' + parentRecord + "._data." + recordType + "." + property);
        }
    },

    /**
     * @Deprecated
     *
     *
     * @param recordType
     * @param property
     * @param parentRecord
     * @returns {*}
     */
    getUserProfileImageUrl: function (relationshipName) {
        if (this.get('_data.'+relationshipName+'._data.profilePicture.url')) {
            return this.get('_data.'+relationshipName+'._data.profilePicture.secureUrl');
        } else if (this.get('_data.'+relationshipName+'._data.fbid')) {
            return "https://res.cloudinary.com/mycqs/image/facebook/c_thumb,e_improve,g_faces:center,w_150/" +
            this.get('_data.'+relationshipName+'._data.fbid');
        } else {
            return "https://d3uzzgmigql815.cloudfront.net/img/silhouette.png";
        }
    }
});

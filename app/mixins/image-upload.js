import Ember from 'ember';
import EmberParseAdapter from 'ember-parse-adapter/adapters/application';
import ParseHelper from '../utils/parse-helper';

export default Ember.Mixin.create({
    featherEditor: null,

    tools: ['text', 'draw', 'crop', 'resize', 'orientation', 'brightness'],

    imageFile: {
        url: null,
        base64: null,
        style: null,
        isDefault: true
    },

    /**
     * @Function Set Default Image
     * @param {String} url
     */
    setDefaultImage: function (url) {
        this.set('imageFile.url', url);
        this.set('imageFile.style', "background-image:url('" + url + "');");
        this.set('imageFile.isDefault', true);
        this.set('imageFile.base64', null);
    },

    initializeFeatherEditor: function () {
        var featherEditor = new Aviary.Feather({
            apiKey: '49f5fc178c5c4df5b052c62430ccc074',
            theme: 'light', // Check out our new 'light' and 'dark' themes!
            tools: this.get('tools'),
            appendTo: '',
            fileFormat: 'jpg',
            enableCORS: true,
            maxSize: '1000',
            onSave: function (imageID, newURL) {
                var base64 = $('#avpw_canvas_element')[0].toDataURL("image/jpeg", 0.8),
                    base64String = base64.replace(/^data:image\/(png|jpeg);base64,/, "");
                this.set('imageFile.base64', base64String);
                this.set('imageFile.url', newURL);
                this.set('imageFile.style', "background-image:url('" + newURL + "');");
                this.set('imageFile.isDefault', false);
                this.get('featherEditor').close();
            }.bind(this),
            onError: function (errorObj) {
                alert(errorObj.message);
            }
        });
        this.set('featherEditor', featherEditor);
    }.on('init'),

    actions: {
        /**
         * @Action Preview Image
         */
        previewImage: function () {
            var oFReader = new FileReader();
            oFReader.readAsDataURL(document.getElementById("imageInput").files[0]);

            oFReader.onload = function (oFREvent) {
                var base64 = oFREvent.target.result;
                this.set('imageFile.url', base64);
                this.set('imageFile.base64', base64);
                this.set('imageFile.style', "background-image:url('" + base64 + "');");
                this.send('editImage');
                this.set('imageFile.isDefault', false);
            }.bind(this);
        },

        editImage: function () {
            this.get('featherEditor').launch({
                image: 'image-holder',
                url: this.get('imageFile.url')
            });
        },

        /**
         * @Action Upload Image
         *
         * @returns {Object} image
         */
        uploadImage: function () {
            this.send('incrementLoadingItems');
            return ParseHelper.uploadFile(this, 'image.jpg', {base64: this.get('imageFile.base64')})
                .then(function (response) {
                    var image = Ember.Object.create({
                        type:"__File", name:response.name, url:response.url});
                    this.send('decrementLoadingItems');
                    this.send('saveUploadedImage', image);
                }.bind(this), function (error) {
                    console.dir(error);
                    // The file either could not be read, or could not be saved to Parse.
                    this.send('decrementLoadingItems');
                }.bind(this));
        }
    }

});

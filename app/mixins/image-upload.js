import Ember from 'ember';
import EmberParseAdapter from '../adapters/parse';
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

    initializeFeatherEditor: function () {
        var featherEditor = new Aviary.Feather({
            apiKey: 'f1e1a7583f443151',
            apiVersion: 3,
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
        uploadImage: function () {
            //var parseFile = new Parse.File('image.jpg', {base64: this.get('imageFile.base64')});
            this.send('incrementLoadingItems');
            return ParseHelper.uploadFile(this, 'image.jpg', {base64: this.get('imageFile.base64')})
                .then(function (image) {
                    var image = new EmberParseAdapter.File(image.name, image.url);
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

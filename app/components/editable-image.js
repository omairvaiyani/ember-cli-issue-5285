import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Component.extend({
    classNames: ['editable-image-container', 'inline-block'],
    /**
     * @Property Input Id
     * Dynamic id needed if the
     * page has multiple instances
     * of this: cannot have duplicate
     * ids.
     */
    inputId: function () {
        return "editable-image-input-" + $(this)[0].elementId;
    }.property(),

    /**
     * @Property Image Holder Id
     * Dynamic id needed if the
     * page has multiple instances
     * of this: cannot have duplicate
     * ids.
     */
    imageHolderId: function () {
        return "image-holder-" + $(this)[0].elementId;
    }.property(),

    /**
     * @Property Edit Drop Down Id
     * Dynamic id needed if the
     * page has multiple instances
     * of this: cannot have duplicate
     * ids.
     */
    editDropDownId: function () {
        return "drop-down-" + $(this)[0].elementId;
    }.property(),

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
    setDefaultImage: function () {
        var url = this.get('imageUrl');
        this.set('imageFile.url', url);
        this.set('imageFile.style', "background-image:url('" + url + "');");
        this.set('imageFile.base64', null);
    }.on('init'),

    featherEditor: null,

    tools: ['text', 'draw', 'crop', 'resize', 'orientation', 'brightness'],

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

                if (this.get('saveAfterEdit'))
                    this.send('uploadImage');

            }.bind(this),
            onError: function (errorObj) {
                alert(errorObj.message);
            }
        });
        this.set('featherEditor', featherEditor);
    }.on('init'),

    /**
     * @Property Preview Class
     *
     * Allows the components
     * preview element to be
     * customised. Multiple
     * classes can be added
     * here with spaces.
     */
    previewClass: "",

    /**
     * @Property Preview Classes
     *
     * Appends 'previewClass' to
     * default class of 'image-preview'
     * to the image preview element.
     */
    previewClasses: function () {
        return "image-preview " + this.get('previewClass');
    }.property("previewClass.length"),

    /**
     * @Function Update Default Image
     * @param {String} url
     */
    updateDefaultImage: function () {
        var url = this.get('imageUrl');
        if(!url)
            return;
        this.set('imageFile.url', url);
        this.set('imageFile.style', "background-image:url('" + url + "');");
        this.set('imageFile.base64', null);
    }.observes('imageUrl.length'),

    /**
     * @Property Save After Edit
     * If true, as soon as the image
     * editor is closed with the
     * save button, the image is
     * uploaded to Parse and
     * save actions are called.
     */
    saveAfterEdit: false,

    /**
     * @Property Show Remove Image
     * Shown if image does exists
     */
    showRemoveImage: function () {
        return !!this.get('image');
    }.property('image'),

    actions: {
        triggleFileInput: function () {
            $("#" + this.get('inputId')).click();
        },

        /**
         * @Action Preview Image
         */
        previewImage: function () {
            var oFReader = new FileReader();
            oFReader.readAsDataURL(document.getElementById(this.get('inputId')).files[0]);

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
                image: this.get('imageHolderId'),
                url: this.get('imageFile.url')
            });
        },

        removeImage: function () {
            this.set('imageFile.url', "");
            this.set('imageFile.style', "background-image:url('" + "" + "');");
            this.set('imageFile.isDefault', false);
            this.set('imageFile.base64', null);

            // Send Save without any image
            this.send('saveUploadedImage');
        },

        /**
         * @Action Upload Image
         *
         * @returns {Object} image
         */
        uploadImage: function () {
            var parentController = this.get('parentController');
            parentController.send('incrementLoadingItems');
            return ParseHelper.uploadFile(parentController, 'image.jpg', {base64: this.get('imageFile.base64')})
                .then(function (response) {
                    var imageData = Ember.Object.create({
                        type: "__File", name: response.name, url: response.url
                    });
                    if (parentController)
                        parentController.send('decrementLoadingItems');
                    this.send('saveUploadedImage', imageData);
                }.bind(this), function (error) {
                    console.dir(error);
                    // The file either could not be read, or could not be saved to Parse.
                    if (parentController)
                        parentController.send('decrementLoadingItems');
                }.bind(this));
        },

        /**
         * @Action Save Uploaded Image
         * Override in Controller
         * @param {Object} imageData
         */
        saveUploadedImage: function (imageData) {
            this.get('parentController').send('saveUploadedImage', imageData);
        }
    }
});

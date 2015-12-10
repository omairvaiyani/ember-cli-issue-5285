import Ember from 'ember';

export default Ember.Mixin.create({
    previousRoutes: new Ember.A(),

    actions: {
        addRouteToHistory: function (path, label, transition, paramPath, subParamPath) {
            var previousRoute = new Ember.Object();
            previousRoute.set('path', path);
            previousRoute.set('label', label);
            if(paramPath && transition.params[path])
                previousRoute.set('param', transition.params[path][paramPath]);
            if(subParamPath && transition.params[path])
                previousRoute.set('subParam', transition.params[path][subParamPath]);
            previousRoute.set('queryParams', transition.queryParams);
            this.get('previousRoutes').insertAt(0, previousRoute);
        }
    }
});

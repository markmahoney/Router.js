var router = (function (window, $, History, undefined) {
    var document = window.document,
        console = window.console || { log: function () {} },
        setTimeout = window.setTimeout,

        initialized,
        routes = [],
        currentPath, 
        currentRoute,
        containerToUpdate,

        // options with default values
        defaultTitle = document.title,
        defaultAction = function () {},
        beforeUpdateBegins = defaultAction,
        beforeShowingUpdatedContent = defaultAction,
        afterShowingUpdatedContent = defaultAction,
        defaultTransitionIn = function (el, finishedCallback) {
            el.show();
            if (finishedCallback) finishedCallback();
        },
        defaultTransitionOut = function (el, finishedCallback) {
            el.hide();
            if (finishedCallback) finishedCallback();
        };

    if (!$ || !History || !History.enabled) {
        return false;
    }

    // find a route whose pattern matches the given path
    function findRoute(path) {
        var route = null;

        for (var i = 0, len = routes.length; i < len && !route; i++) {
            if (routes[i] && routes[i](path)) {
                route = routes[i];
            }
        }

        return route;
    }

    // once a path change has been processed, find a matching route and update the content
    var updatePage = (function () {
        var transitioning = false,
            queuedPath = null;

        function routeHasBeenUpdated() { return !!(queuedPath); }
        
        function hideContent(path, route) {
            function transitionFinished() {
                if (!routeHasBeenUpdated()) {
                    fetchContent(path, route);
                } else {
                    setTimeout(function () { initiateTransition(queuedPath); }, 0);
                }
            }
            
            if (currentRoute) {
                currentRoute.unloadContent();
            }
            
            beforeUpdateBegins(containerToUpdate);

            if (route.transitionOut) {
                route.transitionOut(containerToUpdate, transitionFinished);
            } else {
                defaultTransitionOut(containerToUpdate, transitionFinished);
            }
        }

        function fetchContent(path, route) {
            $.ajax({
                dataType: 'html',
                url: path,
                error: function (response, status, error) {
                    console.log('error fetching path: ' + path);
                    console.log(response);
                },
                complete: function (response, status) {
                    console.log(response);
                    containerToUpdate.html(response.responseText);

                    if (!routeHasBeenUpdated()) {
                        showContent(path, route);
                    } else {
                        setTimeout(function () { initiateTransition(queuedPath); }, 0);
                    }
                }
            });
        }

        function showContent (path, route) {
            function transitionFinished() {
                wrapUp(path, route);
                
                if (!routeHasBeenUpdated()) {
                    afterShowingUpdatedContent(containerToUpdate);
                    route.afterShowingContent();
                } else {
                    setTimeout(function () { initiateTransition(queuedPath); }, 0);
                }
            }

            beforeShowingUpdatedContent(containerToUpdate);
            route.beforeShowingContent();
            
            if (route.transitionIn) {
                route.transitionIn(containerToUpdate, transitionFinished);
            } else {
                defaultTransitionIn(containerToUpdate, transitionFinished);
            }
        };

        function wrapUp(path, route) {
            currentRoute = route;
            currentPath = path;
            transitioning = false;
        }

        function initiateTransition(path) {
            var route = findRoute(path);

            transitioning = true;
            queuedPath = null;

            // see if we found a matching route
            if (route) {

                // if we specifically flagged this route to not be handled, simply update the address to reload the page
                if (route.noRouting) {
                    window.location = path;

                // this route registered a special case which returned true, meaning it updated the page for us
                } else if (route.willUpdateInternally(path, currentPath)) {
                    wrapUp(path, route);
                    
                // hide old page, get new page, and show it
                } else {
                    hideContent(path, route);
                }


            // no matching route was found; just fetch the page and guess at the body ID
            } else {
                hideContent(path, router.defaultRoute);
            }
        }

        var api = function (path) {
            if (!transitioning) {
                initiateTransition(path);
            } else {
                queuedPath = path;
            }
        };

        api.showContent = showContent;

        return api;
    })();
    
    // callback for path updates
    function addressChanged() {
        var state = History.getState(),
            path = state.url;

        console.log('path changed: ' + path);
        History.log('path changed: ' + path);
        
        updatePage(path);

        initialized = true;
    }

    function go(path, skipAddressChange) {
        console.log('go: ' + path);
        
        if (skipAddressChange) {
            updatePage(path);
        } else {
            History.pushState({}, defaultTitle, path, true);
        }
    }

    function checkClick(e) {
        var link = e.target;

        // see if we clicked a link
        while (link && link.tagName !== 'A' && link.tagName != 'BODY') {
            link = link.parentNode;
        }

        // now see if we should route this or just let go
        if (link && link.tagName === 'A' && !link.getAttribute('data-no-routing')) {
            go(link.href);
            return false;
        }

        return true;
    }

    $(document).ready(function () {
        var body = $(document.body);

        body.click(checkClick);
        containerToUpdate = containerToUpdate || body;

        History.Adapter.bind(window, 'statechange', addressChanged);

        console.log('router initialized');
    });

    return {
        configure: function (opts) {
            defaultTransitionOut = opts.defaultTransitionOut || defaultTransitionOut;
            defaultTransitionIn = opts.defaultTransitionIn || defaultTransitionIn;

            if (opts.containerToUpdate) {
                $(document).ready( function () {
                    containerToUpdate = $(opts.containerToUpdate);
                });
            }
        },

        // add a route to the list
        addRoute: function (route) {
            routes.push(route);
            return routes.length - 1;
        },

        // remove a route from the list
        removeRoute: function (routeIndex) {
            if (routeIndex > -1 && routeIndex < routes.length) {
                routes[routeIndex] = null;
            }
        },

        go: go
    };
})(window, jQuery, History);

router.createRoute = (function () {
    var baseFunctions = ['beforeShowingContent', 'afterShowingContent', 'unloadContent', 'willUpdateInternally'],
        length = baseFunctions.length;
    
    return function (pattern, opts) {
        // function to determine if path matches this route
        var api = function (testPath) { return pattern.test(testPath); },
            i = 0,
            defaultAction = function () { return false; };

        opts = opts || {};
        pattern = new RegExp(pattern);

        // attach any defined settings to the route
        for (; i < length; ++i) {
            if (opts[baseFunctions[i]]) {
                api[baseFunctions[i]] = opts[baseFunctions[i]];
            } else {
                api[baseFunctions[i]] = defaultAction;
            }
        };

        api.bodyID = opts.bodyID || '';
        api.bodyClass = opts.bodyClass || '';
        api.noRouting = opts.noRouting || false;

        api.transitionIn = opts.transitionIn || null;
        api.transitionOut = opts.transitionOut || null;

        return api;
    };
})();

router.defaultRoute = router.createRoute(/.*/);
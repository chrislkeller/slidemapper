/* ==========================================================
 * slidemapper.js v0.0.1
 * http://github.com/cavis/slidemapper
 * ==========================================================
 * Copyright (c) 2012 Ryan Cavis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */


/* ==========================================================
 * Constrainer control - allow limiting slides to a
 * rectangular area of the map.
 * ========================================================== */
L.Control.Constrainer = L.Control.extend({
  options: { position: 'topright' },

  statics: {
    START: L.Browser.touch ? 'touchstart' : 'mousedown',
    END: L.Browser.touch ? 'touchend' : 'mouseup',
    MOVE: L.Browser.touch ? 'touchmove' : 'mousemove'
  },

  onAdd: function (map) {
    var className = 'smapp-control-constrain',
        container = L.DomUtil.create('div', className);

    this._link   = L.DomUtil.create('a', className + '-selection', container);
    this._dashes = L.DomUtil.create('div', className + '-selection-inner', this._link);
    this._link.href  = '#';
    this._link.title = 'Constrain Selection';

    // toggle state when clicking on the
    L.DomEvent
      .addListener(this._link, 'click', L.DomEvent.stopPropagation)
      .addListener(this._link, 'click', L.DomEvent.preventDefault)
      .addListener(this._link, 'click', this._onClick, this);
    return container;
  },

  // toggle click handler
  _onClick: function(e) {
    if (L.DomUtil.hasClass(this._link, 'down')) {
      L.DomUtil.removeClass(this._link, 'down');
      this._onEndDraw();
      if (this._rectangle) {
        this._map.removeLayer(this._rectangle);
        this._rectangle = false;
      }
    }
    else {
      L.DomUtil.addClass(this._link, 'down');
      this._map.dragging._draggable.disable();
      this._setDrawingCursor();
      L.DomEvent.addListener(this._map._mapPane, L.Control.Constrainer.START, this._onStartDraw, this);
    }
  },

  // mouse down handler
  _onStartDraw: function(e) {
    this._origin = this._map.mouseEventToLatLng(e);
    L.DomEvent
      .addListener(document, L.Control.Constrainer.MOVE, L.DomEvent.stopPropagation)
      .addListener(document, L.Control.Constrainer.MOVE, L.DomEvent.preventDefault)
      .addListener(document, L.Control.Constrainer.MOVE, this._onDraw, this)
      .addListener(document, L.Control.Constrainer.END, this._onEndDraw, this);
  },

  // mouse moving handler
  _onDraw: function(e) {
    var latlng = this._map.mouseEventToLatLng(e);
    var bounds = new L.LatLngBounds(this._origin, latlng);
    if (this._rectangle) {
      this._rectangle.setBounds(bounds);
    }
    else {
      this._rectangle = new L.Rectangle(bounds, {
        clickable: false,
        fillOpacity: .1,
        opacity: .2,
        weight: 3
      });
      this._map.addLayer(this._rectangle);
    }
  },

  // mouse up handler
  _onEndDraw: function(e) {
    this._map.dragging._draggable.enable();
    this._restoreCursor();
    L.DomEvent.removeListener(this._map._mapPane, L.Control.Constrainer.START, this._onStartDraw);
    L.DomEvent.removeListener(document, L.Control.Constrainer.MOVE, this._onDraw);
    L.DomEvent.removeListener(document, L.Control.Constrainer.END, this._onEndDraw);
  },

  // add global drawing cursor
  _setDrawingCursor: function() {
    document.body.className += ' smapp-slider-dragging';
  },

  // remove global dragging cursor
  _restoreCursor: function() {
    document.body.className = document.body.className.replace(/ smapp-slider-dragging/g, '');
  },

});

L.Map.mergeOptions({constrainControl: true});

L.Map.addInitHook(function () {
  if (this.options.constrainControl) {
    this.constrainControl = new L.Control.Constrainer();
    this.addControl(this.constrainControl);
  }
});


/* ==========================================================
 * Clustering control - allow limiting slides to a rectangular area
 * of the map.
 * ========================================================== */
L.Control.Cluster = L.Control.extend({
  options: { position: 'topright' },

  statics: {
    START: L.Browser.touch ? 'touchstart' : 'mousedown',
    END: L.Browser.touch ? 'touchend' : 'mouseup',
    MOVE: L.Browser.touch ? 'touchmove' : 'mousemove',
    MIN: 0,
    MAX: 120,
    STEP: 10,
    DEFAULT: 80
  },

  onAdd: function (map) {
    var className = 'smapp-control-cluster',
        container = L.DomUtil.create('div', className);
    this._slider   = L.DomUtil.create('div', className + '-slider', container);
    this._range    = L.DomUtil.create('div', className + '-slider-range', this._slider);
    this._handleCt = L.DomUtil.create('div', className + '-slider-handle-ct', this._slider);
    this._handle   = L.DomUtil.create('span', className + '-slider-handle', this._handleCt);
    this._handle.title = 'Clustering Size';

    // initial size
    var initialStep = this._valToStep(L.Control.Cluster.DEFAULT);
    this._setStep(initialStep);

    // listen to dragging on the handle
    L.DomEvent
      .addListener(this._handle, 'click', L.DomEvent.stopPropagation)
      .addListener(this._handle, 'click', L.DomEvent.preventDefault)
      .addListener(this._handle, L.Control.Cluster.START, L.DomEvent.preventDefault)
      .addListener(this._handle, L.Control.Cluster.MOVE, L.DomEvent.stopPropagation)
      .addListener(this._handle, L.Control.Cluster.MOVE, L.DomEvent.preventDefault)
      .addListener(this._handle, L.Draggable.START, this._onStartDrag, this);

    // listen to clicking on the range
    L.DomEvent
      .addListener(this._slider, 'click', L.DomEvent.stopPropagation)
      .addListener(this._slider, 'click', L.DomEvent.preventDefault)
      .addListener(this._slider, 'click', this._onClick, this);
    return container;
  },

  // slider click handler
  _onClick: function(e) {
    var step = this._yCoordToStep(e.pageY);
    this._setStep(step);
    this._onEndDrag();
  },

  // mouse down handler
  _onStartDrag: function(e) {
    this._map.dragging._draggable.disable();
    this._setMovingCursor();
    L.DomEvent
      .addListener(document, L.Control.Cluster.MOVE, L.DomEvent.stopPropagation)
      .addListener(document, L.Control.Cluster.MOVE, L.DomEvent.preventDefault)
      .addListener(document, L.Control.Cluster.MOVE, this._onDrag, this);
    L.DomEvent.addListener(document, L.Control.Cluster.END, this._onEndDrag, this);
  },

  // mouse moving handler
  _onDrag: function(e) {
    var step = this._yCoordToStep(e.pageY);
    this._setStep(step);
  },

  // mouse up handler
  _onEndDrag: function(e) {
    this._map.dragging._draggable.enable();
    this._restoreCursor();
    L.DomEvent.removeListener(document, L.Control.Cluster.MOVE, this._onDrag);
    L.DomEvent.removeListener(document, L.Control.Cluster.END, this._onEndDrag);
  },

  // initialize slider steps
  _initSteps: function() {
    var height = parseInt(L.DomUtil.getStyle(this._slider, 'height').replace('px', ''));
    var top    = L.DomUtil.getViewportOffset(this._slider).y;
    var bot    = top + height;
    var half   = (.5 * (L.Control.Cluster.STEP / (L.Control.Cluster.MAX - L.Control.Cluster.MIN))) * height;
    this._steps = [];
    for (var i=L.Control.Cluster.MIN; i<=L.Control.Cluster.MAX; i+=L.Control.Cluster.STEP) {
      var perc = i / (L.Control.Cluster.MAX - L.Control.Cluster.MIN);
      this._steps.push({y: bot - (height * perc) - half, val: i, perc: perc});
    }
  },

  // transform a point to a step
  _yCoordToStep: function(yCoord) {
    if (!this._steps) this._initSteps();
    for (var i=0; i<this._steps.length; i++) {
      if (yCoord >= this._steps[i].y) return this._steps[i];
    }
    return this._steps[this._steps.length - 1];
  },

  // transform a value to a step number
  _valToStep: function(val) {
    if (!this._steps) this._initSteps();
    for (var i=0; i<this._steps.length; i++) {
      if (val <= this._steps[i].val) return this._steps[i];
    }
    return this._steps[this._steps.length - 1];
  },

  // helper to convert to percentage string
  _stepToPercentage: function(step) {
    return Math.round(100*step.perc) + '%';
  },

  // set the slider to a step
  _setStep: function(step) {
    this._range.style.height = this._stepToPercentage(step);
    this._handle.style.bottom = this._stepToPercentage(step);
    this._handle.style['font-weight'] = (step.val == 0) ? 'normal' : 'bold';
    this._handle.innerHTML = (step.val == 0) ? 'off' : step.val;
  },

  // add global dragging cursor
  _setMovingCursor: function() {
    document.body.className += ' smapp-slider-dragging';
  },

  // remove global dragging cursor
  _restoreCursor: function() {
    document.body.className = document.body.className.replace(/ smapp-slider-dragging/g, '');
  }

});

L.Map.mergeOptions({clusterControl: true});

L.Map.addInitHook(function () {
  if (this.options.clusterControl) {
    this.clusterControl = new L.Control.Cluster();
    this.addControl(this.clusterControl);
  }
});


/* ==========================================================
 *
 *
 * ========================================================== */
(function($) {

  // default configuration options
  var defaultOptions = {
    mapType: 'cloudmade',
    apiKey:  null,
    center:  [40.423, -98.7372],
    zoom:    4,
    minZoom: 2,
    maxZoom: 10,
    slides: [],
    cluster: true,
    constrainControl: true,
    maxClusterZoom: 9
  };


  // private vars, defined at the beginning of every call, saved at the end
  var DATA;
  var $THIS;


  // helper functions to slide left and right
  function _slideOut($el, goLeft) {
    var end = goLeft ? '-100%' : '100%';
    $el.css({left: '0%', display: 'block'}).removeClass('active');
    $el.animate({left: end}, 400, 'swing', function() { $el.removeAttr('style'); });
  }
  function _slideIn($el, goLeft) {
    var start = goLeft ? '100%' : '-100%';
    $el.css('left', start).addClass('active');
    $el.animate({left: '0%'}, 400, 'swing', function() { $el.removeAttr('style'); });
  }


  // public methods
  var methods = {

    // initial setup
    init: function(options) {
      if (!DATA) {
        DATA = {};
        DATA.options = $.extend({}, defaultOptions, options);

        // create the slideshow
        $THIS.append('<div class="smapp-slides"><div class="carousel"></div><span class="left control">‹</span><span class="right control">›</span></div><div class="smapp-map"></div>');
        var prevEl = $('.smapp-slides', $THIS)[0];
        var mapEl  = $('.smapp-map',  $THIS)[0];

        // left/right listeners
        $THIS.find('.control').click(function(e) {
          $(this).hasClass('left') ? $THIS.slideMapper('prev') : $THIS.slideMapper('next');
        });
        $(document).keydown(function(e) {
          if (e.keyCode == 37) $THIS.slideMapper('prev');
          if (e.keyCode == 39) $THIS.slideMapper('next');
        });

        // pick the tiles
        var tileUrl = '';
        if (DATA.options.mapType == 'cloudmade') {
            tileUrl = 'http://{s}.tile.cloudmade.com/{{APIKEY}}/997/256/{z}/{x}/{y}.png';
            tileUrl = tileUrl.replace('{{APIKEY}}', DATA.options.apiKey);
        }

        // find the center latlng
        var center = new L.LatLng(DATA.options.center[0], DATA.options.center[1]);

        // initialize the map
        DATA.map = new L.Map(mapEl);
        var tiles = new L.TileLayer(tileUrl, {
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
            minZoom: DATA.options.minZoom,
            maxZoom: DATA.options.maxZoom
        });
        DATA.map.setView(center, DATA.options.zoom).addLayer(tiles);

        // setup data containers
        DATA.clusterer = new LeafClusterer(DATA.map);
        DATA.items = [];
        DATA.index = null;
        methods.add(DATA.options.slides);
      }
    },

    // add a datapoint/marker to the map
    add: function(latlng, mapHtml, slideHtml) {
      if (arguments.length == 1 && arguments[0] instanceof Array) {
        for (var i=0; i<arguments[0].length; i++) {
          methods.add.apply(this, arguments[0][i]);
        }
        return;
      }

      // add to map
      var latlng = new L.LatLng(latlng[0], latlng[1]);
      var marker = new L.Marker(latlng).bindPopup(mapHtml);
      marker.index = DATA.items.length;
      marker.on('click', function(e) {
        methods.move(e.target.index);
      });
      DATA.clusterer.addMarker(marker);

      // render to preview
      var caro = $THIS.find('.carousel');
      var prev = $('<div class="item"><div class="item-inner">'+slideHtml+'</div></div>').appendTo(caro);

      // store data in markers array
      DATA.items.push({
        marker:  marker,
        preview: prev,
      });

      // initial showing
      if (DATA.items.length == 1) {
        prev.addClass('active');
        marker.openPopup();
        DATA.map.panTo(latlng);
        DATA.index = 0;
      }
      if (DATA.items.length > 1) {
        $THIS.find('.control.right').show();
      }
    },

    // move to a different marker
    move: function(index) {
      if (index === null || index >= DATA.items.length || index < 0 || index == DATA.index) return;

      // slide out the old, in the new preview
      _slideOut(DATA.items[DATA.index].preview, (index > DATA.index));
      _slideIn(DATA.items[index].preview, (index > DATA.index));

      // open new popup and update stored index
      var latlng = DATA.items[index].marker.getLatLng();
      var popup  = DATA.items[index].marker._popup.setLatLng(latlng);
      DATA.map.openPopup(popup);
      DATA.map.panTo(latlng);
      DATA.index = index;

      // update controls
      if (index == 0) {
        $THIS.find('.control.left').hide();
        $THIS.find('.control.right').show();
      }
      else if (index == DATA.items.length - 1) {
        $THIS.find('.control.left').show();
        $THIS.find('.control.right').hide();
      }
      else {
        $THIS.find('.control.left').show();
        $THIS.find('.control.right').show();
      }
    },

    // next!
    next: function() {
      methods.move(DATA.index === null ? 0 : DATA.index + 1);
    },

    // previous!
    prev: function() {
      methods.move(DATA.index === null ? 0 : DATA.index - 1);
    }

  };

  // attach jquery namespace
  $.fn.slideMapper = function(method) {
    if (this.length > 1) {
      $.error('SlideMapper currently only supports 1 map per page');
    }
    else if (method && typeof method !== 'object' && !methods[method]) {
      $.error('Method '+method+' does not exist on jQuery.slideMapper');
    }
    else {

      // call for each element
      for (var i=0; i<this.length; i++) {

        // setup private vars
        $THIS = $(this[i]);
        DATA  = $THIS.data('slideMapper');

        // call init if no method given
        if (methods[method]) {
          if (!DATA) $.error('Method '+method+' called on uninitialized element');
          else methods[method].apply(this[i], Array.prototype.slice.call(arguments, 1));
        }
        else {
          methods.init.apply(this[i], arguments);
        }

        // save data changes
        $THIS.data('slideMapper', DATA);
      }
      return this;
    }
  };

}) (jQuery);

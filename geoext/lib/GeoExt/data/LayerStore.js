/* Copyright (C) 2008-2009 The Open Source Geospatial Foundation ¹
 * Published under the BSD license.
 * See http://geoext.org/svn/geoext/core/trunk/license.txt for the full text
 * of the license.
 * 
 * ¹ pending approval */

/**
 * @include GeoExt/data/LayerReader.js
 */

Ext.namespace("GeoExt.data");

/**
 * Class: GeoExt.data.LayerStoreMixin
 * A store that synchronizes a layers array of an {OpenLayers.Map} with a
 * layer store holding {<GeoExt.data.LayerRecord>} entries.
 * 
 * This class can not be instantiated directly. Instead, it is meant to extend
 * {Ext.data.Store} or a subclass of it:
 * (start code)
 * var store = new (Ext.extend(Ext.data.Store, GeoExt.data.LayerStoreMixin))({
 *     map: myMap,
 *     layers: myLayers
 * });
 * (end)
 * 
 * For convenience, a {<GeoExt.data.LayerStore>} class is available as a
 * shortcut to the Ext.extend sequence in the above code snippet. The above
 * is equivalent to:
 * (start code)
 * var store = new GeoExt.data.LayerStore({
 *     map: myMap,
 *     layers: myLayers
 * });
 * (end)
 */
GeoExt.data.LayerStoreMixin = {
    /**
     * APIProperty: map
     * {OpenLayers.Map} Map that this store will be in sync with.
     */
    map: null,

    /**
     * Property: reader
     * {<GeoExt.data.LayerReader>} The reader used to get
     *     <GeoExt.data.LayerRecord> objects from {OpenLayers.Layer}
     *     objects.
     */
    reader: null,

    /**
     * Constructor: GeoExt.data.LayerStoreMixin
     * 
     * Parameters:
     * config - {Object}
     * 
     * Valid config options:
     * map - {OpenLayers.Map|<GeoExt.MapPanel>} map to sync the layer store
     *     with.
     * layers - {Array(OpenLayers.Layer)} Layers that will be added to the
     *     layer store (and the map, because we are already syncing).
     * recordType - {<GeoExt.data.LayerRecord>} If provided, a custom layer
     *     record type with additional fields will be used. Default fields for
     *     every layer record are {OpenLayers.Layer} layer and {String} title.
     */
    constructor: function(config) {
        config = config || {};
        config.reader = config.reader ||
                        new GeoExt.data.LayerReader({}, config.recordType);
        var map = config.map instanceof GeoExt.MapPanel ?
                  config.map.map : config.map;
        delete config.map;
        arguments.callee.superclass.constructor.call(this, config);
        if(map) {
            // create a snapshop of the map's layers
            var layers = map.layers;
            var layer;
            // walk through the layers snapshot and add layers to the store
            for(var i=0; i<layers.length; ++i) {
                layer = layers[i];
                this.add((this.reader.readRecords([layer])).records);
            }

            this.bind(map);
            config.layers && map.addLayers(config.layers);
        }
    },

    /**
     * APIMethod: bind
     * Bind this store to a map instance, once bound the store
     * is synchronized with the map and vice-versa.
     * 
     * Parameters:
     * map - {OpenLayers.Map} The map instance.
     */
    bind: function(map) {
        if(!this.map) {
            this.map = map;
            map.events.on({
                "changelayer": this.onChangeLayer,
                "addlayer": this.onAddLayer,
                "removelayer": this.onRemoveLayer,
                scope: this
            });
            this.on({
                "add": this.onAdd,
                "remove": this.onRemove,
                scope: this
            });
        }
    },

    /**
     * APIMethod: unbind
     * Unbind this store from the map it is currently bound.
     */
    unbind: function() {
        if(this.map) {
            this.map.events.un({
                "changelayer": this.onChangeLayer,
                "addlayer": this.onAddLayer,
                "removelayer": this.onRemoveLayer,
                scope: this
            });
            this.un({
                "add": this.onAdd,
                "remove": this.onRemove,
                scope: this
            });
            this.map = null;
        }
    },
    
    /**
     * Method: onChangeLayer
     * Handler for layer changes.  When layer order changes, this moves the
     *     appropriate record within the store.
     *
     * Parameters:
     * evt - {Object}
     */
    onChangeLayer: function(evt) {
        var layer = evt.layer;
        if(evt.property === "order") {
            if(!this._adding && !this._removing) {
                var layerIndex = this.map.getLayerIndex(layer);
                var recordIndex = this.findBy(function(rec, id) {
                    return rec.get("layer") === layer;
                });
                if(recordIndex > -1) {
                    if(layerIndex !== recordIndex) {
                        var record = this.getAt(recordIndex);
                        this._removing = true;
                        this.remove(record);
                        delete this._removing;
                        this._adding = true;
                        this.insert(layerIndex, [record]);
                        delete this._adding;
                    }
                }
            }
        }
    },
   
    /**
     * Method: onAddLayer
     * Handler for a map's addlayer event
     * 
     * Parameters:
     * evt - {Object}
     */
    onAddLayer: function(evt) {
        if(!this._adding) {
            var layer = evt.layer;
            this._adding = true;
            this.add((this.reader.readRecords([layer])).records);
            delete this._adding;
        }
    },
    
    /**
     * Method: onRemoveLayer
     * Handler for a map's removelayer event
     * 
     * Parameters:
     * evt - {Object}
     */
    onRemoveLayer: function(evt){
        if(!this._removing) {
            var layer = evt.layer;
            this._removing = true;
            this.remove(this.getById(layer.id));
            delete this._removing;
        }
    },
    
    /**
     * Method: onAdd
     * Handler for a store's add event
     * 
     * Parameters:
     * store - {<Ext.data.Store>}
     * records - {Array(Ext.data.Record)}
     * index - {Number}
     */
    onAdd: function(store, records, index) {
        if(!this._adding) {
            this._adding = true;
            var layer;
            for(var i=records.length-1; i>=0; --i) {
                layer = records[i].get("layer");
                this.map.addLayer(layer);
                if(index !== this.map.layers.length-1) {
                    this.map.setLayerIndex(layer, index);
                }
            }
            delete this._adding;
        }
    },
    
    /**
     * Method: onRemove
     * Handler for a store's remove event
     * 
     * Parameters:
     * store - {<Ext.data.Store>}
     * records - {Array(Ext.data.Record)}
     * index - {Number}
     */
    onRemove: function(store, record, index){
        if(!this._removing) {
            this._removing = true;
            this.map.removeLayer(record.get("layer"));
            delete this._removing;
        }
    }
};

/**
 * Class: GeoExt.data.LayerStore
 * Default implementation of an {Ext.data.Store} extended with
 * {<GeoExt.data.LayerStoreMixin>}
 * 
 * Inherits from:
 * - {Ext.data.Store}
 * - {<GeoExt.data.LayerStoreMixin>}
 */
/**
 * Constructor: GeoExt.data.LayerStore
 * 
 * Parameters:
 * config - {Object} See {<GeoExt.data.LayerStoreMixin>} and 
 * http://extjs.com/deploy/dev/docs/?class=Ext.data.Store for valid config
 *     options. 
 */
GeoExt.data.LayerStore = Ext.extend(
    Ext.data.Store,
    GeoExt.data.LayerStoreMixin
);

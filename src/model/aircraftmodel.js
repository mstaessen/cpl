var db = require('../db')
  , Utils = require('../utils');

var AircraftModelCreator = function(args) {
    if (!args.manufacturer) throw "aircraft model manufacturer not set";
    if (!args.code) throw "aircraft model code not set";
    if (!args.name) throw "aircraft model name not set";
    
    if (args.id) {
        this.aircraftModel = args;
        this._changed = false;
        print("Aircraft model " + args.name + " loaded from db");
    } else {
        this.aircraftModel = db.AircraftModel.build(
            args,
            ['manufacturer', 'code', 'name']
        );
        db.applyLater(this.aircraftModel, 'save', []);
        this._changed = true;
        print("Aircraft model " + args.name + " created");
    }
    
    this.aircraftLayouts = new Utils.DBCollection(
        this.aircraftModel,
        'setAircraftLayouts',
        db.applyLater,
        []
    );
    
    aircraftModels.push(this);
}

AircraftModelCreator.prototype.getDO = function () {
    return this.aircraftModel;
}

AircraftModelCreator.prototype.checkDO = function(args) {
    if (args.code !== this.aircraftModel.code) {
        throw "Aircraft model codes don't match";
    }
    if (args.name && args.name !== this.aircraftModel.name) {
        throw "Aircraft model names don't match for code " + args.code;
    }
    if (args.manufacturer && args.manufacturer !== this.aircraftModel.manufacturer) {
        throw "Aircraft model manufacturer doesn't match for code " + args.code;
    }
}

AircraftModelCreator.prototype._Layout = function(layout) {
    this.aircraftLayouts.push(layout);
    
    if (layout.AircraftModelId) {
        return;
    }
    
    this._changed |= !(layout.AircraftModelId === this.aircraftModel.id);
    if (this._changed) {
        this.aircraftLayouts.store();
    }
}

var aircraftModels = new Utils.MultiIndexedSet(['code']);

exports.AircraftModel = function(args) {
    var model = aircraftModels.get(args);
    
    if (model) {
        model.checkDO(args);
        return model;
    }
    
    return new AircraftModelCreator(args);
}

exports.AircraftModel.get = function(args) {
    var model = aircraftModels.get(args);
    
    if (model) {
        model.checkDO(args);
    }
    
    return model;
}
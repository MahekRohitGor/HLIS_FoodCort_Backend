var driverModel = require("../models/driver_model");
var common = require("../../../../utilities/common");
const response_code = require("../../../../utilities/response-error-code");
const {default: localizify} = require('localizify');
const validator = require("../../../../middlewares/validator");
const { t } = require('localizify');
const vrules = require("../../../validation_rules");

class User{
    async signup(req, res) {
        try {
            const request_data = req.body;
            const response_data = await driverModel.signup(request_data, req.files);
            await common.response(res, response_data);

        } catch (error) {
            return res.json(common.encrypt({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error.message
            }));
        }
    }
    
    async verifyOtp(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));

        const response_data = await driverModel.verifyOTP(request_data);
        await common.response(res, response_data);

    }

    async forgotPassword(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));

        const response_data = await driverModel.forgotPassword(request_data);
        await common.response(res, response_data);
    }

    async resetPassword(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));

        driverModel.resetPassword(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async login(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));

        const response_data = await driverModel.login(request_data);
        await common.response(res, response_data);
    }

    async change_password(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.change_password(request_data, driver_id);
        await common.response(res, response_data);
    }

    async logout(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.logout(request_data, driver_id);
        await common.response(res, response_data);
    }

    async add_vehicle_data(req,res){
        const request_data = req.body;
        const files = req.files;
        const driver_id = req.user_id;

        const response_data = await driverModel.add_vehicle_data(request_data, driver_id, files);
        await common.response(res, response_data);
    }

    async list_nearby_orders(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.list_nearby_orders(request_data, driver_id);
        await common.response(res, response_data);
    }

    async accept_order(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.accept_order(request_data, driver_id);
        await common.response(res, response_data);
    } 

    async updateDeliveryStatus(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.updateDeliveryStatus(request_data, driver_id);
        await common.response(res, response_data);
    }

    async get_upcoming_deliveries(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.get_upcoming_deliveries(request_data, driver_id);
        await common.response(res, response_data);
    }

    async verify_delivery(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.verify_delivery(request_data, driver_id);
        await common.response(res, response_data);
    }

    async set_availability(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.set_availability(request_data, driver_id);
        await common.response(res, response_data);
    }

    async show_earnings(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.show_earnings(request_data, driver_id);
        await common.response(res, response_data);
    }

    async list_driver_notification(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.list_driver_notification(request_data, driver_id);
        await common.response(res, response_data);
    }

    async show_ratings(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const driver_id = req.user_id;

        const response_data = await driverModel.show_ratings(request_data, driver_id);
        await common.response(res, response_data);
    }

}


module.exports = new User();
const common = require("../../../../utilities/common");
const database = require("../../../../config/database");
const response_code = require("../../../../utilities/response-error-code");
const md5 = require("md5");
const {default: localizify} = require('localizify');
const en = require("../../../../language/en");
const fr = require("../../../../language/fr");
const guj = require("../../../../language/guj");
const validator = require("../../../../middlewares/validator");
const constants = require("../../../../config/constants");
var lib = require('crypto-lib');
const moment = require('moment');
const {contactUs, sendOTP, welcomeEmail, orderConfirmationEmail} = require("../../../../template");

const { t } = require('localizify');
const { drop } = require("lodash");
const { schedule } = require("node-cron");

class userModel{
        async signup(request_data) {
            try {
                if (!request_data.email_id || !request_data.signup_type) {
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('missing_values')
                    }
                }

                const data_received = {
                    email_id: request_data.email_id,
                    signup_type: request_data.signup_type
                };

                const device_data = {
                    device_type: request_data.device_type,
                    os_version: request_data.os_version,
                    app_version: request_data.app_version
                };
        
                let userData;
                let insertResult;
        
                if (data_received.signup_type === 'S') {
                    userData = {
                        user_name: request_data.user_name,
                        email_id: request_data.email_id,
                        phone_number: request_data.phone_number,
                        password_: md5(request_data.password_),
                        signup_type: request_data.signup_type
                    };
        
                    const existingUser = await common.findExistingUser(database, userData.email_id, userData.phone_number);
                    
                    if (existingUser.length > 0) {
                        await common.handleExistingUserOTP(database, existingUser[0]);
                    }
        
                } else {
                    userData = {
                        email_id: data_received.email_id,
                        social_id: request_data.social_id,
                        signup_type: request_data.signup_type
                    };
                
                    const existingUser = await common.findExistingUser(database, data_received.email_id);
                    if (existingUser.length > 0) {
                        await common.handleExistingUserOTP(database, existingUser[0]);
                    }
                }
                
                const insertIntoUser = `INSERT INTO tbl_user SET ?`;
                [insertResult] = await database.query(insertIntoUser, [userData]);
                
                const devicetoken = common.generateToken(40);
                device_data.device_token = devicetoken;
                device_data.user_id = insertResult.insertId;
                
                const insertDeviceData = `INSERT INTO tbl_device_info SET ?`;
                await database.query(insertDeviceData, device_data);
                
                const otp_ = common.generateOtp(4);
                const updateOtpQuery = `UPDATE tbl_user SET otp = ?, is_profile_completed = 0 WHERE user_id = ?`;
                await database.query(updateOtpQuery, [otp_, insertResult.insertId]);

                // send otp to driver
                const subject = "Cargo Rider - OTP for Verification";
                const email = request_data.email_id;

                const data = {
                    name: request_data.full_name || 'User',
                    otp: otp_
                }

                try {
                    const htmlMessage = sendOTP(data);
                    await common.sendMail(subject, email, htmlMessage);
                    console.log("OTP email sent successfully!");
                } catch (error) {
                    console.error("Error sending OTP email:", error);
                }
                
                const userFind = `SELECT user_name FROM tbl_user WHERE user_id = ? AND is_active = 1 AND is_deleted = 0`;
                const [user] = await database.query(userFind, [insertResult.insertId]);

                const subject_email = "Welcome to Food Cort!";
                const welcomeMessageData = {
                    name: request_data.user_name || "User"
                }

                try {
                    const htmlMessage = welcomeEmail(welcomeMessageData);
                    await common.sendMail(subject_email, email, htmlMessage);
                    console.log("Welcome Email Sent Success");
                } catch (error) {
                    console.error("Error sending Welcome email:", error);
                }
                
                await database.query(`insert into tbl_notification_pref (user_id) values (?);`, [insertResult.insertId]);

                return {
                    code: response_code.SUCCESS,
                    message: t('signup_success'),
                    data: user
                };
                
                } catch (error) {
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('some_error_occurred'),
                        data: error.message
                    };
                }
        }
    
        async verifyOTP(request_data) {
            try {
                const { email_id, otp } = request_data;
                const selectUserQuery = `
                    SELECT user_id, otp, is_profile_completed 
                    FROM tbl_user 
                    WHERE email_id = ? AND is_active = 1 AND is_deleted = 0
                `;
                const [userResult] = await database.query(selectUserQuery, [email_id]);
        
                if (userResult.length === 0) {
                    return {
                        code: response_code.NOT_FOUND,
                        message: t('email_id_not_registered')
                    };
                }

                const user = userResult[0];
                const user_id = user.user_id;
        
                if (!user.otp) {
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('otp_not_found')
                    };
                }
        
                if (otp === user.otp) {
                    const updateUserQuery = `
                        UPDATE tbl_user 
                        SET otp = NULL, 
                            is_profile_completed = 1 
                        WHERE user_id = ?
                    `;
                    await database.query(updateUserQuery, [user_id]);
        
                    return {
                        code: response_code.SUCCESS,
                        message: t('otp_verify_success')
                    };
                } else {
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('invalid_otp')
                    };
                }
        
            } catch (error) {
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t('some_error_occurred'),
                    data: error.message
                };
            }
        }

        async login(request_data) {
            try {
                const login_type = request_data.login_type;
        
                if (login_type === 'S') {
                    const email_id = request_data.email_id;
                    const password_ = md5(request_data.password_);
        
                    const findUser = `
                        SELECT user_id, user_name, signup_type 
                        FROM tbl_user 
                        WHERE email_id = ? 
                        AND password_ = ? 
                        AND is_active = 1 
                        AND is_deleted = 0 
                        AND is_profile_completed = 1
                    `;
                    const [user] = await database.query(findUser, [email_id, password_]);
        
                    if (user.length === 0) {
                        return {
                            code: response_code.OPERATION_FAILED,
                            message: t('user_not_found')
                        };
                    }
        
                    if (user[0].signup_type !== 'S') {
                        return {
                            code: response_code.OPERATION_FAILED,
                            message: t('invalid_login_type')
                        };
                    }
        
                    const token = common.generateToken(40);
                    const updateUser = `
                        UPDATE tbl_user 
                        SET login_type = 'S',
                            is_login = 1 
                        WHERE user_id = ?
                    `;
                    await database.query(updateUser, [user[0].user_id]);

                    const updateDevice = `
                        UPDATE tbl_device_info 
                        SET user_token = ?
                        WHERE user_id = ?
                    `;
                    await database.query(updateDevice, [token, user[0].user_id]);
        
                    return {
                        code: response_code.SUCCESS,
                        message: t('login_success'),
                        data: "WELCOME " + user[0].full_name
                    };
        
                } else {
                    const email_id = request_data.email_id;
                    const social_id = request_data.social_id;
                    const login_type = request_data.login_type;
                    
                    if(login_type !== 'G' && login_type !== 'F'){
                        return {
                            code: response_code.OPERATION_FAILED,
                            message: t('invalid_login_type')
                        };
                    }

                    if (!email_id || !social_id) {
                        return {
                            code: response_code.OPERATION_FAILED,
                            message: t('missing_required_fields')
                        };
                    }
        
                    const findUser = `
                        SELECT user_id, user_name, signup_type 
                        FROM tbl_user 
                        WHERE email_id = ? 
                        AND social_id = ?
                        AND is_active = 1 
                        AND is_deleted = 0 
                        AND is_profile_completed = 1
                    `;
                    const [user] = await database.query(findUser, [email_id, social_id]);
        
                    if (user.length === 0) {
                        return {
                            code: response_code.OPERATION_FAILED,
                            message: t('user_not_found')
                        };
                    }
        
                    if (user[0].signup_type !== login_type) {
                        return {
                            code: response_code.OPERATION_FAILED,
                            message: t('singup_login_type_mismatch')
                        };
                    }

                    const updateUser = `
                        UPDATE tbl_user 
                        SET login_type = ?,  
                            is_login = 1 
                        WHERE user_id = ?
                    `;
                    await database.query(updateUser, [login_type, token, user[0].user_id]);
        
                    const device_token = common.generateToken(40);
                    const token = common.generateToken(40);

                    const updateDeviceToken = `
                        UPDATE tbl_device_info 
                        SET device_token = ?, user_token = ? 
                        WHERE user_id = ?
                    `;
                    await database.query(updateDeviceToken, [device_token, user[0].user_id]);
        
                    return {
                        code: response_code.SUCCESS,
                        message: t('login_success'),
                        data: "WELCOME " + user[0].full_name
                    };
                }
        
            } catch (error) {
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t('some_error_occured'),
                    data: error.message
                };
            }
        }
        
        async home_page_items(request_data, user_id){
            try{
                const category_id = request_data.category_id;
                const searchText = request_data.searchText;

                // HOT DEALS
                // TOP 5 ITEMS with more number of voucher and high avg_rating with search functionality
                const findItemsQuery = `
                    select i.item_id, count(v.voucher_id) as cnt, i.item_name, i.avg_rating, i.price, i.cover_image from tbl_item i 
                    inner join tbl_rest r 
                    on i.rest_id = r.rest_id
                    inner join tbl_voucher v 
                    on v.rest_id = r.rest_id
                    where i.item_name like ? and i.avg_rating > 3.5 and category_id = ? and i.is_deleted = 0
                    group by i.item_name, i.avg_rating, i.price, i.cover_image, i.item_id
                    having cnt >= 1
                    order by cnt desc
                    limit 5; 
                `;

                const pattern = `%${searchText}%`

                const [items] = await database.query(findItemsQuery, [pattern, category_id]);
                if(items.length === 0){
                    return {
                        code: response_code.NOT_FOUND,
                        message: t('not_found'),
                        data: items
                    }
                }

                const userDetails = `SELECT * FROM tbl_user where user_id = ?`;
                const [user] = await database.query(userDetails, [user_id]);

                const findFav = `SELECT item_id from tbl_user_fav where user_id = ?`;
                const [favs] = await database.query(findFav, [user_id]);

                const userfavs = favs.map(fav => fav.item_id);
                console.log(userfavs.includes(1));
                console.log(items);

                const response = items.map(item => ({
                    item_id: item.item_id,
                    item_cover_image: item.cover_img,
                    item_name: item.item_name,
                    average_rating: item.avg_rating,
                    price: "Rs. " + item.price,
                    latitude: user[0].latitude,
                    longitude: user[0].longitude,
                    welcomeMsg: "Hello " + user[0].user_name,
                    is_liked: userfavs.includes(item.item_id) ? 1 : 0
                }));

                return {
                    code: response_code.SUCCESS,
                    message: t('HOT DEALS !'),
                    data: response
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t('some_error_occured'),
                    data: error.message
                }
            }
        }

        async filter(request_data, user_id){
            try{
                const minPrice = request_data.minPrice || 50;
                const maxPrice = request_data.maxPrice || 1000;
                const category_id = request_data.category_id || 1;
                let query;

                const userDetails = `SELECT * FROM tbl_user where user_id = ?`;
                const [user] = await database.query(userDetails, [user_id]);

                const latitude = user[0].latitude;
                const longitude = user[0].longitude;

                if(!request_data.is_recommended && !request_data.is_week_top && !request_data.is_nearby && !request_data.is_fast){
                    query = `select * from tbl_item where is_week_top = 1 and price between ? and ? and category_id = ?`;
                }
                else if(request_data.is_recommended && !request_data.is_week_top && !request_data.is_nearby && !request_data.is_fast){
                    query = `select * from tbl_item where is_recommended = 1 and price between ? and ? and category_id = ?`;
                }
                else if(!request_data.is_recommended && !request_data.is_week_top && request_data.is_nearby && !request_data.is_fast){
                    query = `select i.*,
                        concat(ROUND(( 3959 * ACOS( COS( RADIANS(${latitude}) )  
                                * COS( RADIANS( r.latitude ) ) 
                                * COS( RADIANS( r.longitude ) - RADIANS(${longitude}) )  
                                + SIN( RADIANS(${latitude}) )  
                                * SIN( RADIANS( r.latitude) ) ) ),0), " km") < 8200 as distance 
                        from tbl_item i 
                        inner join tbl_rest r 
                        on i.rest_id = r.rest_id
                        where price between ? and ? and category_id = ?
                        having distance < 100`
                }
                else if(!request_data.is_recommended && !request_data.is_week_top && !request_data.is_nearby && request_data.is_fast){
                    query = `select i.*,
                        concat(ROUND(( 3959 * ACOS( COS( RADIANS(${latitude}) )  
                                * COS( RADIANS( r.latitude ) ) 
                                * COS( RADIANS( r.longitude ) - RADIANS(${longitude}) )  
                                + SIN( RADIANS(${latitude}) )  
                                * SIN( RADIANS( r.latitude) ) ) ),0), " km") < 8200 as distance 
                        from tbl_item i 
                        inner join tbl_rest r 
                        on i.rest_id = r.rest_id
                        where price between ? and ? and category_id = ?
                        having distance < 50`
                } else{
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('invalid_filters')
                    }
                }

                const [items] = await database.query(query, [minPrice, maxPrice, category_id]);

                if(items.length === 0){
                    return {
                        code: response_code.NOT_FOUND,
                        message: t('not_found'),
                        data: items
                    }
                }

                const findFav = `SELECT item_id from tbl_user_fav where user_id = ?`;
                const [favs] = await database.query(findFav, [user_id]);
                const userfavs = favs.map(fav => fav.item_id);  

                const response = items.map(item => ({
                    item_id: item.item_id,
                    item_cover_image: item.cover_img,
                    item_name: item.item_name,
                    average_rating: item.avg_rating,
                    price: "Rs. " + item.price,
                    latitude: user[0].latitude,
                    longitude: user[0].longitude,
                    welcomeMsg: "Hello " + user[0].user_name,
                    is_liked: userfavs.includes(item.item_id) ? 1 : 0,
                    time_taken: (item.distance / 20)*60  + " mins",
                    distance: item.distance + " km"
                }));

                return {
                    code: response_code.SUCCESS,
                    message: t('data_found'),
                    data: response
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t('some_error_occured'),
                    data: error.message
                }
            }
        }

        async list_item_detail(request_data, user_id){
            try{
                const item_id = request_data.item_id;
                const query = `select * from tbl_item where item_id = ?`;

                const [itemDetails] = await database.query(query, [item_id]);

                if(itemDetails.length === 0){
                    return {
                        code: response_code.NOT_FOUND,
                        message: t('item_not_found')
                    }
                }

                const userDetails = `SELECT * FROM tbl_user where user_id = ?`;
                const [user] = await database.query(userDetails, [user_id]);

                const findFav = `SELECT item_id from tbl_user_fav where user_id = ?`;
                const [favs] = await database.query(findFav, [user_id]);
                const userfavs = favs.map(fav => fav.item_id); 
                
                const findCat = `SELECT category_name from tbl_category where category_id = ?`;
                const [res] = await database.query(findCat, [itemDetails[0].category_id]);

                const resp = {
                    item_id: itemDetails[0].item_id,
                    item_cover_image: constants.link + itemDetails[0].cover_image,
                    item_name: itemDetails[0].item_name,
                    item_avg_rating: itemDetails[0].avg_rating,
                    category_name: res[0].category_name,
                    item_cal: itemDetails[0].calories + "Kcal",
                    item_prep_time_mins: itemDetails[0].prep_time_mins + "mins",
                    item_desc: itemDetails[0].description,
                    item_price: "$" + itemDetails[0].price,
                    is_liked: userfavs.includes(itemDetails[0].item_id) ? 1 : 0
                }

                return {
                    code: response_code.SUCCESS,
                    message: t('found'),
                    data: resp
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t('some_error_occured'),
                    data: error.message
                }
            }
        }

        async add_to_cart(request_data, user_id) {
            try {
                const items = request_data.items;
                if (!items || items.length === 0) {
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: "No items provided to add to cart"
                    };
                }
        
                const cart_nums = common.generateToken(4);
        
                for (const item of items) {
                    const [priceData] = await database.query(
                        `SELECT price from tbl_item where item_id = ? AND is_deleted = 0`, 
                        [item.item_id]
                    );
                    
                    if (priceData.length > 0) {
                        const cart_data = {
                            cart_num: cart_nums,
                            item_id: item.item_id,
                            item_qty: item.item_qty || 1,
                            extra_ing_id: item.extra_ing_id,
                            ing_qty: item.ing_qty,
                            user_id: user_id
                        };
        
                        await database.query(`INSERT INTO tbl_cart SET ?`, [cart_data]);
                    }
                }
        
                return {
                    code: response_code.SUCCESS,
                    message: 'Items added to cart successfully',
                    data: {
                        cart_number: cart_nums
                    }
                };
        
            } catch(error) {
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async place_order(request_data, user_id) {
            try {
                const [driver] = await database.query(`SELECT * FROM tbl_driver where is_available = 1`);
                if (driver.length === 0) {
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('cuurently_no_delivery_partner_avail_try_again_after_some_time')
                    }
                }
        
                const [cartItems] = await database.query(
                    `SELECT * FROM tbl_cart WHERE user_id = ?`,
                    [user_id]
                );
        
                if (!cartItems || cartItems.length === 0) {
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: "No items in cart to place order"
                    };
                }
        
                const order_number = common.generateToken(8);
                const shipping_charge = 85;
        
                const orderQuery = `INSERT into tbl_order (user_id, order_num, shipping_charge, status, order_step) values (?,?,?,?,?)`;
                const [data] = await database.query(orderQuery, [user_id, order_number, shipping_charge, 'pending', '1']);
        
                const order_id = data.insertId;
                let sub_total = 0;
        
                for (const item of cartItems) {
                    const [priceData] = await database.query(
                        `SELECT price from tbl_item where item_id = ? AND is_deleted = 0`, 
                        [item.item_id]
                    );
                    
                    if (priceData.length > 0) {
                        const price = priceData[0].price;
                        const item_total = price * (item.item_qty || 1);
                        sub_total += item_total;
        
                        const order_detail = {
                            order_id: order_id,
                            item_id: item.item_id,
                            item_qty: item.item_qty || 1,
                            extra_ing_id: item.extra_ing_id,
                            ing_qty: item.ing_qty,
                            total_price: item_total
                        };
        
                        await database.query(`INSERT INTO tbl_order_details SET ?`, [order_detail]);
                    }
                }
        
                await database.query(
                    `UPDATE tbl_order SET sub_total = ? WHERE order_id = ?`,
                    [sub_total, order_id]
                );
        
                const method_id = request_data.method_id;
                const address_id = request_data.address_id;
                const voucher_code = request_data.voucher_code || null;
        
                let discount_amt = 0;
                
                if (voucher_code) {
                    const [discountData] = await database.query(
                        `SELECT * from tbl_voucher where voucher_code = ?`, 
                        [voucher_code]
                    );
        
                    if (discountData.length > 0) {
                        const discountPercentage = discountData[0].discount_percentage;
                        discount_amt = (sub_total * discountPercentage) / 100;
                    }
                }
        
                const grand_total = sub_total + shipping_charge - discount_amt;
        
                const updateOrderDetail = `UPDATE tbl_order SET 
                    method_id = ?, 
                    delivery_address_id = ?,
                    voucher_code = ?,
                    discount_amt = ?,
                    order_step = '3',
                    grand_total = ?,
                    status = 'confirmed',
                    delivery_status = 'accepted'
                    WHERE order_id = ?`;
        
                await database.query(updateOrderDetail, [
                    method_id, 
                    address_id, 
                    voucher_code, 
                    discount_amt, 
                    grand_total, 
                    order_id
                ]);
        
                const [address] = await database.query(
                    `SELECT * FROM tbl_user_delivery_address where address_id = ?`, 
                    [address_id]
                );
        
                const driver_id = driver[0].driver_id;
                await database.query(
                    `UPDATE tbl_driver SET order_id_assigned = ?, is_available = 0 where driver_id = ?`, 
                    [order_id, driver_id]
                );
        
                await database.query(
                    `DELETE FROM tbl_cart WHERE user_id = ?`,
                    [user_id]
                );
        
                const [resultNew] = await database.query(
                    `SELECT * FROM tbl_order where order_id = ?`, 
                    [order_id]
                );
        
                const response = {
                    order_number: resultNew[0].order_num,
                    sub_total: resultNew[0].sub_total,
                    shipping_charge: resultNew[0].shipping_charge,
                    voucher_code: voucher_code || "No Voucher Used",
                    grand_total: grand_total,
                    status: resultNew[0].status,
                    delivery_status: resultNew[0].delivery_status,
                    address: address[0].address_line_1 + ", " + address[0].address_line_2 + ", " + 
                            address[0].city + ", " + address[0].state + ", " + address[0].pincode,
                    delivery_partner: driver[0].driver_name,
                    delivery_partner_phone: driver[0].phone_number
                }
        
                const [pref] = await database.query(
                    `SELECT * from tbl_notification_pref where user_id = ?`, 
                    [user_id]
                );
                
                if (pref && pref[0].is_complete_order) {
                    await database.query(`INSERT INTO tbl_notification (
                        cover_image,
                        title,
                        descriptions,
                        user_id,
                        notification_type,
                        is_read
                    ) VALUES (
                        'alert.png',
                        "Order was placed Successfully",
                        "Your Order was placed Successfully",
                        ?,
                        'alert',
                        0
                    );`, [user_id]);
                }
        
                return {
                    code: response_code.SUCCESS,
                    message: ('order_placed_successfully'),
                    data: response
                }
        
            } catch(error) {
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async list_user_order(request_data, user_id){
            try{
                let query;

                if((request_data.is_current_order && request_data.is_history) || (!request_data.is_current_order && !request_data.is_history) ){
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('invalid_filter')
                    }
                }

                if(request_data.is_current_order){
                    query = `SELECT * FROM tbl_order where user_id = ? and delivery_status not in ('delivered') and status = 'confirmed'`;

                } else if(request_data.is_history){
                    query = `SELECT * FROM tbl_order where user_id = ? and delivery_status in ('delivered') and status = 'confirmed'`;
                }

                const [orders] = await database.query(query, [user_id]);

                if(orders.length === 0){
                    return {
                        code: response_code.NOT_FOUND,
                        message: t('not_found')
                    }
                }

                const [findOrder] = await database.query(`SELECT * from tbl_order_details where order_id = ?`, orders[0].order_id)
                const [findItem] = await database.query(`SELECT * from tbl_item where item_id = ?`, findOrder[0].item_id)
                const [findRest] = await database.query(`SELECT * from tbl_rest where rest_id = ?`, findItem[0].rest_id)

                const response = orders.map(order => ({
                    rest_name: findRest[0].rest_name,
                    cover_image: constants.link + findRest[0].cover_image,
                    date_of_order: order.created_at,
                    grand_total: order.grand_total,
                    button1: request_data.is_current_order ? "track order" : "re-order",
                    button2: request_data.is_current_order ? "detail" : "rate",
                }))

                return {
                    code: response_code.SUCCESS,
                    message: t('here_are_orders'),
                    data: response
                }
                

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t('some_error_occured'),
                    data: error.message
                }
            }
        }
        
        async list_user_favs(request_data, user_id){
            try{
                const search_text = "";

                if(request_data.search_text){
                    search_text = request_data.search_text;
                }
                const category_id = request_data.category_id;
                const pattern = `%${search_text}%`;
                
                const userDetails = `SELECT * FROM tbl_user where user_id = ?`;
                const [user] = await database.query(userDetails, [user_id]);

                const latitude = user[0].latitude;
                const longitude = user[0].longitude;

                const query = `select *, concat(ROUND(( 3959 * ACOS( COS( RADIANS(${latitude}) )  
                                * COS( RADIANS( r.latitude ) ) 
                                * COS( RADIANS( r.longitude ) - RADIANS(${longitude}) )  
                                + SIN( RADIANS(${latitude}) )  
                                * SIN( RADIANS( r.latitude) ) ) ),0), " km") < 8200 as distance from tbl_user_fav uf 
                inner join tbl_item i on i.item_id = uf.item_id 
                inner join tbl_rest r
                on r.rest_id = i.rest_id
                where i.category_id = ? and i.item_name like ?`;

                const [results] = await database.query(query, [category_id, pattern]);
                if(results.length === 0){
                    return {
                        code: response_code.OPERATION_FAILED,
                        message: t('results_not_found')
                    }
                }

                const response = results.map(result=>({
                    image: constants.link + result.cover_image,
                    item_name: result.item_name,
                    avg_rating: result.avg_rating,
                    price: result.price,
                    time: (result.distance / 20)*60,
                    is_fav: 1
                }));

                return {
                    code: response_code.SUCCESS,
                    message: t('data_found'),
                    data: response
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t('some_error_occured'),
                    data: error.message
                }
            }
        }

        async list_notifications(request_data, user_id){
            try{
                const getNotification = `SELECT * FROM tbl_notification where user_id = ?`;
                const [notifications] = await database.query(getNotification, [user_id]);

                if(notifications.length === 0){
                    return {
                        code: response_code.NOT_FOUND,
                        message: t("no_notification_found")
                    }
                }

                await database.query(`UPDATE tbl_notification SET is_read = 1, read_at = current_timestamp() where user_id = ?`, [user_id]);

                const response = notifications.map(notification => ({
                    cover_image: notification.cover_image,
                    title: notification.title,
                    descriptions: notification.descriptions,
                    time: notification.created_at
                }));

                return {
                    code: response_code.SUCCESS,
                    message: t('notifications_listed'),
                    data: response
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async add_delivery_address(request_data, user_id){
            try{
                const address_data = {
                    latitude: request_data.latitude,
                    longitude: request_data.longitude,
                    address_line_1: request_data.address_line_1,
                    address_line_2: request_data.address_line_2,
                    city: request_data.city,
                    state: request_data.state,
                    pincode: request_data.pincode,
                    country_id: request_data.country_id,
                    user_id: user_id
                }

                await database.query(`INSERT INTO tbl_user_delivery_address SET ?`, [address_data]);

                return {
                    code: response_code.SUCCESS,
                    message: t('address_added_success')
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async add_payment_method(request_data, user_id){
            try{
                const payment_method_data = {
                    card_number: request_data.card_number,
                    card_holder_name: request_data.card_holder_name,
                    expired_at: request_data.expires_at,
                    cvv: request_data.cvv,
                    user_id: user_id
                }

                await database.query(`INSERT INTO tbl_payment_method SET ?`, [payment_method_data]);

                const [pref] = await database.query(`SELECT * from tbl_notification_pref where user_id = ?`, [user_id]);
                
                if(pref && pref[0].is_payment){
                    await database.query(`INSERT INTO tbl_notification (
                            cover_image,
                            title,
                            descriptions,
                            user_id,
                            notification_type,
                            is_read
                        ) VALUES (
                            'alert.png',
                            "Payment Method Added",
                            "A New Payment Method was added to your account.",
                            ?,
                            'alert',
                            0
                        );`, [user_id]);
                }

                return {
                    code: response_code.SUCCESS,
                    message: t('payment_method_added_success')
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async order_track(request_data, user_id){
            try{
                const order_id = request_data.order_id;
                const [orders] = await database.query(`SELECT * FROM tbl_order where 
                    order_id = ? and user_id = ? and status = 'confirmed'`, [order_id, user_id]);

                const [users] = await database.query(`SELECT * from tbl_user where user_id = ?`, [user_id]);

                if(orders.length === 0){
                    return {
                        code: response_code.NOT_FOUND,
                        message: t("not_found")
                    }
                }
                console.log(users[0].latitude);

                const [delivery_partner] = await database.query(`SELECT * from tbl_driver where order_id_assigned = ?`, [order_id]);
                
                if(delivery_partner.length === 0){
                    return {
                        code: response_code.SUCCESS,
                        message: t('delivery_partner_not_picked_up_order')
                    }
                }
                
                const response = {
                    latitude_order: delivery_partner[0].latitude,
                    longitude_order: delivery_partner[0].longitude,
                    latitude_user: users[0].latitude,
                    longitude_user: users[0].longitude,
                    delivery_partner: delivery_partner[0].driver_name,
                    delivery_partner_phone: delivery_partner[0].phone_number,
                    delivery_status: orders[0].delivery_status
                }

                return {
                    code: response_code.SUCCESS,
                    message: t('data_found'),
                    data: response
                }


            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async list_voucher(request_data, user_id){
            try{
                const [vouchers] = await database.query(`SELECT * FROM tbl_voucher`);
                if(vouchers.length === 0){
                    return {
                        code: response_code.NOT_FOUND,
                        message: t("not_found")
                    }
                }

                const response = vouchers.map(voucher => ({
                    image: constants.link + voucher.banner_image_name,
                    title: voucher.title,
                    descriptions: voucher.descriptions
                }));

                return {
                    code: response_code.SUCCESS,
                    message: t("data_found"),
                    data: response
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async list_reviews(request_data, user_id){
            try{
                const [reviews] = await database.query(`SELECT * FROM item_rating_review where item_id = ?`, [request_data.item_id]);
                const [users] = await database.query(`SELECT * FROM tbl_user where user_id = ?`, [user_id]);
                if(reviews.length === 0){
                    return {
                        code: response_code.DATA_NOT_FOUND,
                        message: t('data_not_found')
                    }
                }

                const resp = reviews.map(review => ({
                    user_name: users[0].user_name,
                    profile_pic: constants.link + users[0].profile_pic,
                    review: review.review,
                    rating: review.rating
                }));

                return {
                    code: response_code.SUCCESS,
                    message: t('data_found'),
                    data: resp
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

        async edit_profile(request_data, user_id){
            try{
                const data = {
                    user_name: request_data.user_name,
                    profile_pic: request_data.profile_pic
                }

                await database.query(`UPDATE tbl_user SET ? where user_id = ? and is_active = 1 and is_deleted = 0`, [data, user_id]);
                const [users] = await database.query(`SELECT * from tbl_user where user_id = ?`, [user_id]);

                const resp = {
                    name: users[0].user_name,
                    email_id: users[0].email_id,
                    phone_number: users[0].phone_number
                }

                return {
                    code: response_code.SUCCESS,
                    message: t('Profile Edited Successfully'),
                    data: resp
                }

            } catch(error){
                return {
                    code: response_code.OPERATION_FAILED,
                    message: t("some_error_occured"),
                    data: error.message
                }
            }
        }

}

module.exports = new userModel();
import React, { Fragment, useEffect, useState } from 'react'
import MetaData from '../layout/MetaData'
import CheckoutSteps from './CheckoutSteps'
import { useAlert } from 'react-alert'
import { useDispatch, useSelector } from 'react-redux'
import { createOrder, clearErrors } from '../../actions/orderActions'
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js'
import axios from 'axios'

const options = {
    style: {
        base: {
            fontSize: '16px'
        },
        invalid: {
            color: '#9e2146'
        }
    }
}

const Payment = ({ history }) => {

    const [paymentMethod, setPaymentMethod] = useState('card'); // State to manage payment method

    const alert = useAlert();
    const stripe = useStripe();
    const elements = useElements();
    const dispatch = useDispatch();

    const { user } = useSelector(state => state.auth)
    const { cartItems, shippingInfo } = useSelector(state => state.cart);
    const { error } = useSelector(state => state.newOrder)

    useEffect(() => {
        if (error) {
            alert.error(error)
            dispatch(clearErrors())
        }
    }, [dispatch, alert, error])

    const order = {
        orderItems: cartItems,
        shippingInfo
    }

    const orderInfo = JSON.parse(sessionStorage.getItem('orderInfo'));
    if (orderInfo) {
        order.itemsPrice = orderInfo.itemsPrice
        order.shippingPrice = orderInfo.shippingPrice
        order.taxPrice = orderInfo.taxPrice
        order.totalPrice = orderInfo.totalPrice
    }

    const paymentData = {
        amount: Math.round(orderInfo.totalPrice * 100)
    }

    const submitHandler = async (e) => {
        e.preventDefault();

        document.querySelector('#pay_btn').disabled = true;

        if (paymentMethod === 'card') {
            try {
                const config = {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }

                const res = await axios.post('/api/v1/payment/process', paymentData, config)
                const clientSecret = res.data.client_secret;

                if (!stripe || !elements) {
                    return;
                }

                const result = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: elements.getElement(CardNumberElement),
                        billing_details: {
                            name: user.name,
                            email: user.email
                        }
                    }
                });

                if (result.error) {
                    alert.error(result.error.message);
                    document.querySelector('#pay_btn').disabled = false;
                } else {
                    if (result.paymentIntent.status === 'succeeded') {
                        order.paymentInfo = {
                            id: result.paymentIntent.id,
                            status: result.paymentIntent.status
                        }

                        dispatch(createOrder(order))
                        history.push('/success')
                    } else {
                        alert.error('Có một số vấn đề trong khi xử lý thanh toán')
                    }
                }

            } catch (error) {
                document.querySelector('#pay_btn').disabled = false;
                alert.error(error.response.data.message)
            }
        } else {
            // COD payment handling
            order.paymentInfo = {
                id: 'COD',
                status: 'Chưa thanh toán'
            }

            dispatch(createOrder(order))
            history.push('/success')
        }
    }

    return (
        <Fragment>
            <MetaData title={'Thông tin thẻ'} />

            <CheckoutSteps shipping confirmOrder payment />

            <div className="row wrapper">
                <div className="col-10 col-lg-5">
                    <form className="shadow-lg" onSubmit={submitHandler}>
                        <h1 className="mb-4">Thông tin thanh toán</h1>

                        <div className="form-group">
                            <label htmlFor="payment_method_field">Phương thức thanh toán</label>
                            <select 
                                id="payment_method_field" 
                                className="form-control" 
                                value={paymentMethod} 
                                onChange={(e) => setPaymentMethod(e.target.value)}>
                                <option value="card">Thẻ tín dụng</option>
                                <option value="cod">Thanh toán khi nhận hàng</option>
                            </select>
                        </div>

                        {paymentMethod === 'card' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="card_num_field">Số thẻ</label>
                                    <CardNumberElement
                                        type="text"
                                        id="card_num_field"
                                        className="form-control"
                                        options={options}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="card_exp_field">Hạn thẻ</label>
                                    <CardExpiryElement
                                        type="text"
                                        id="card_exp_field"
                                        className="form-control"
                                        options={options}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="card_cvc_field">Số CVC</label>
                                    <CardCvcElement
                                        type="text"
                                        id="card_cvc_field"
                                        className="form-control"
                                        options={options}
                                    />
                                </div>
                            </>
                        )}

                        <button
                            id="pay_btn"
                            type="submit"
                            className="btn btn-block py-3"
                        >
                            {paymentMethod === 'card'
                                ? `Thanh toán - ${(orderInfo && orderInfo.totalPrice).toLocaleString()}đ`
                                : `Đặt hàng`}
                        </button>
                    </form>
                </div>
            </div>
        </Fragment>
    )
}

export default Payment

import { BUY_STATUS } from "../types";
import { Dispatch, AnyAction } from "redux";

export const setBuyData = (action: string, data) => async (dispatch) => {
  try {
    switch (action) {
      case BUY_STATUS:
        dispatch({
          type: action,
          payload: data,
        });
        break;
    }
  } catch (error) {
    console.log(error);
  }
};

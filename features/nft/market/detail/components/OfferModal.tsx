import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Dialog, StyledCloseIcon } from "components/Dialog";
import { Button } from "components/Button";
import { DateRange } from "rsuite/DateRangePicker";
import { IconWrapper } from "components/IconWrapper";
import { NftPrice } from "components/NFT/nft-card/price";
import { User, CopyNft, Heart, Clock, Package, Credit } from "icons";
import { useHistory, useParams } from "react-router-dom";
import Link from "next/link";
import { toast } from "react-toastify";
import { useTokenBalance } from "../../../../../hooks/useTokenBalance";
import { useBaseTokenInfo } from "../../../../../hooks/useTokenInfo";
import { NftCard } from "components/NFT/nft-card";
import styled from "styled-components";
import {
  NftInfo,
  CW721,
  Collection,
  Market,
  useSdk,
  getRealTokenAmount,
  PaymentToken,
  toMinDenom,
  SALE_TYPE,
  getFileTypeFromURL,
} from "services/nft";
import { RELOAD_STATUS } from "store/types";
import { walletState } from "state/atoms/walletAtoms";
import { useRecoilValue } from "recoil";
import {
  Modal,
  ChakraProvider,
  ModalContent,
  ModalOverlay,
  useDisclosure,
  HStack,
  Text,
  Stack,
  InputGroup,
  InputRightElement,
  Input,
} from "@chakra-ui/react";
import DatePicker from "rsuite/DatePicker";
import { NftDollarPrice } from "components/NFT/nft-card/price";
import { useDispatch, useSelector } from "react-redux";
import { State } from "store/reducers";
import { fromBase64, toBase64 } from "@cosmjs/encoding";
import { isMobile } from "util/device";

const PUBLIC_MARKETPLACE = process.env.NEXT_PUBLIC_MARKETPLACE || "";

let today = new Date();

type OfferModalProps = {
  collectionId: string;
  id: string;
  highestBid: number;
  callback: any;
};

export const OfferModal = ({
  collectionId,
  id,
  highestBid,
  callback,
}: OfferModalProps) => {
  const { client } = useSdk();
  const { address, client: signingClient } = useRecoilValue(walletState);
  const dispatch = useDispatch();
  const [nft, setNft] = useState<NftInfo>({
    tokenId: id,
    address: "",
    image: "",
    name: "",
    user: "",
    price: "0",
    total: 2,
    collectionName: "",
    symbol: "MARBLE",
    sale: {},
    paymentToken: {},
    type: "image",
    created: "",
    collectionId: 0,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [fee, setFee] = useState(1);
  const [supply, setSupply] = useState(1);
  const [sellType, setSellType] = useState(SALE_TYPE[0]);
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(0);
  const [duration, setDuration] = useState<DateRange>([
    today,
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
  ]);

  const reloadData = useSelector((state: State) => state.reloadData);
  const { reload_status } = reloadData;

  const handleQuantityChange = (event) => {
    setQuantity(event.target.value);
  };
  const handleAmountChange = (event) => {
    setAmount(event.target.value);
  };
  const loadNft = useCallback(async () => {
    if (!client) return;
    if (
      collectionId === undefined ||
      collectionId == "[collection]" ||
      id === undefined ||
      id == "[id]" ||
      id == ""
    )
      return false;
    const marketContract = Market(PUBLIC_MARKETPLACE).use(client);
    let collection = await marketContract.collection(parseInt(collectionId));
    let ipfs_collection = await fetch(
      process.env.NEXT_PUBLIC_PINATA_URL + collection.uri
    );
    let res_collection = await ipfs_collection.json();
    const cw721Contract = CW721(collection.cw721_address).use(client);
    let nftInfo = await cw721Contract.nftInfo(id);
    let ipfs_nft = await fetch(
      process.env.NEXT_PUBLIC_PINATA_URL + nftInfo.token_uri
    );
    let res_nft = await ipfs_nft.json();
    let nft_type = await getFileTypeFromURL(
      process.env.NEXT_PUBLIC_PINATA_URL + res_nft["uri"]
    );
    res_nft["type"] = nft_type.fileType;
    res_nft["created"] = res_nft["owner"];
    res_nft["owner"] = await cw721Contract.ownerOf(id);
    const collectionContract = Collection(collection.collection_address).use(
      client
    );
    let sales: any = await collectionContract.getSales();
    let saleIds = [];
    for (let i = 0; i < sales.length; i++) {
      saleIds.push(sales[i].token_id);
    }
    const response = await fetch(
      process.env.NEXT_PUBLIC_COLLECTION_TOKEN_LIST_URL
    );
    const paymentTokenList = await response.json();
    let paymentTokensAddress = [];
    for (let i = 0; i < paymentTokenList.tokens.length; i++) {
      paymentTokensAddress.push(paymentTokenList.tokens[i].address);
    }
    if (saleIds.indexOf(parseInt(id)) != -1) {
      let sale = sales[saleIds.indexOf(parseInt(id))];
      let paymentToken: any;
      if (sale.denom.hasOwnProperty("cw20")) {
        paymentToken =
          paymentTokenList.tokens[
            paymentTokensAddress.indexOf(sale.denom.cw20)
          ];
      } else {
        paymentToken =
          paymentTokenList.tokens[
            paymentTokensAddress.indexOf(sale.denom.native)
          ];
      }
      res_nft["symbol"] = paymentToken.symbol;
      res_nft["paymentToken"] = paymentToken;
      res_nft["price"] = getRealTokenAmount({
        amount: sale.initial_price,
        denom: paymentToken.denom,
      });
      res_nft["sale"] = sales[saleIds.indexOf(parseInt(id))];
      res_nft["owner"] = sale.provider;
    } else {
      res_nft["price"] = 0;
      res_nft["sale"] = {};
    }
    let uri = res_nft.uri;
    if (uri.indexOf("https://") == -1) {
      uri = process.env.NEXT_PUBLIC_PINATA_URL + res_nft.uri;
    }

    setNft({
      tokenId: id,
      address: "",
      image: uri,
      name: res_nft.name,
      user: res_nft.owner,
      price: res_nft.price,
      total: 1,
      collectionName: res_collection.name,
      symbol: res_nft["symbol"],
      sale: res_nft.sale,
      paymentToken: res_nft.paymentToken,
      type: res_nft.type,
      created: res_nft.created,
      collectionId: parseInt(collectionId),
    });
    //setSupply(res_collection.supply==undefined?1:parseInt(res_collection.supply))
    setFee(res_collection.earningFee);
  }, [client]);

  useEffect(() => {
    loadNft();
  }, [loadNft, collectionId, id]);

  useEffect(() => {}, [duration]);
  const proposeNFT = async (e) => {
    let minAmount = nft.sale.initial_price;
    if (nft.sale.requests.length > 0) {
      minAmount = nft.sale.requests[nft.sale.requests.length - 1].price;
    }
    if (
      amount <
      getRealTokenAmount({ amount: minAmount, denom: nft.paymentToken.denom })
    ) {
      toast.warning(`The offer price should be greater than ${nft.price}.`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      return;
    }
    setIsChecking(true);
    const marketContract = Market(PUBLIC_MARKETPLACE).use(client);
    let collection = await marketContract.collection(Number(collectionId));
    const collectionContract = Collection(collection.collection_address).useTx(
      signingClient
    );
    let msg: any;
    if (nft.paymentToken.type == "cw20") {
      msg = { propose: { token_id: Number(id) } };
      let encodedMsg: string = toBase64(
        new TextEncoder().encode(JSON.stringify(msg))
      );
      let buy = await collectionContract.buy(
        address,
        nft.paymentToken.address,
        parseInt(toMinDenom(amount, nft.paymentToken.denom)).toString(),
        encodedMsg
      );
    } else {
      msg = {
        propose: { token_id: Number(id), denom: nft.paymentToken.denom },
      };
      let buy = await collectionContract.propose(
        address,
        Number(id),
        parseInt(toMinDenom(amount, nft.paymentToken.denom)).toString(),
        nft.paymentToken.denom
      );
    }

    dispatch({
      type: RELOAD_STATUS,
      payload: reload_status + 1,
    });
    toast.success(`You have offered this NFT successfully.`, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
    setIsChecking(false);
    callback();
    onClose();
  };

  const { isOpen, onOpen, onClose } = useDisclosure();
  const TokenLogo = () => {
    return (
      <TokenLogoWrapper>
        <img src={nft.paymentToken.logoUri} alt="token" width="35px" />
        <Text>{nft.symbol}</Text>
      </TokenLogoWrapper>
    );
  };

  const { balance } = useTokenBalance(nft.paymentToken?.symbol);
  const handleOpen = () => {
    if (!address || !signingClient) {
      toast.error(`Please connect your wallet.`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      return;
    }
    onOpen();
  };
  return (
    <ChakraProvider>
      <Button
        className="btn-buy btn-default"
        css={{
          background: "$white",
          color: "$black",
          stroke: "$black",
          width: "100%",
        }}
        variant="primary"
        size="large"
        onClick={handleOpen}
      >
        Place Bid
      </Button>

      <Modal
        blockScrollOnMount={false}
        isOpen={isOpen}
        onClose={onClose}
        isCentered
      >
        <ModalOverlay backdropFilter="blur(14px)" bg="rgba(0, 0, 0, 0.34)" />

        <Container>
          <MainWrapper>
            <Stack spacing={10}>
              <Stack>
                <Title>Place a Bid</Title>
                <p>
                  Once your bid is placed, you will be the highest bidder in the
                  auction.<a href="/">Learn more</a>
                </p>
              </Stack>

              <Stack>
                <h1>
                  Minimum Price:{" "}
                  <span style={{ fontWeight: "300" }}>
                    {Number(highestBid) * 1.05 || Number(nft.price)}{" "}
                    {nft.symbol}
                  </span>
                </h1>

                <InputGroup>
                  <StyledInput
                    placeholder="Enter amount"
                    type="number"
                    onChange={handleAmountChange}
                    value={amount}
                  />
                  <StyledInputRightElement>
                    <TokenLogo />
                  </StyledInputRightElement>
                </InputGroup>

                <Stack
                  justifyContent="space-between"
                  flexDirection="row"
                  alignItems="center"
                >
                  <h1>Available Balance</h1>
                  <h1>
                    {balance}&nbsp;
                    {nft.symbol}
                  </h1>
                </Stack>
              </Stack>

              <Button
                className="btn-buy btn-default"
                css={{
                  background: "$white",
                  color: "$black",
                  stroke: "$black",
                  width: "100%",
                }}
                variant="primary"
                size="large"
                onClick={(e) => {
                  if (amount > balance) return;
                  proposeNFT(e);
                }}
                disabled={amount > balance}
              >
                {amount > balance
                  ? `You Do Not Have Enough ${nft?.symbol}`
                  : "Place Bid"}
              </Button>
            </Stack>

            <CardWrapper>
              <NftCard nft={nft} type="" />
            </CardWrapper>
          </MainWrapper>
        </Container>
      </Modal>
    </ChakraProvider>
  );
};

const Container = styled(ModalContent)`
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border-radius: 30px !important;
  padding: 30px;
  color: white !important;
  overflow: hidden;
  max-width: 1000px !important;
  @media (max-width: 480px) {
    width: 90vw !important;
    padding: 10px;
    max-height: 100vh;
    overflow: auto;
  }
`;
const MainWrapper = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: center;
  column-gap: 30px;
  p {
    font-size: 20px;
    font-family: Mulish;
  }
  h1 {
    font-size: 20px;
  }
  @media (max-width: 480px) {
    flex-direction: column-reverse;
    p {
      font-size: 14px;
    }
    h1 {
      font-size: 14px;
    }
  }
`;
const CardWrapper = styled.div`
  display: flex;
  width: 434px;
  @media (max-width: 480px) {
    width: 100%;
    height: 100%;
    justify-content: center;
    margin-bottom: 20px;
  }
`;
const StyledInput = styled(Input)`
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px;
  font-size: 30px;
  font-weight: 600;
  background: #272734;
  border-radius: 20px !important;
  display: flex;
  align-items: center;
  height: 70px !important;
`;

const TokenLogoWrapper = styled.div`
  background: rgba(0, 0, 0, 0.2);
  border-radius: 60px;
  padding: 10px 20px 10px 10px;
  display: flex;
  align-items: center;
`;

const StyledInputRightElement = styled.div`
  position: absolute;
  right: 30px;
  top: 8px;
`;
const Title = styled.div`
  font-size: 30px;
  font-weight: 600;
  @media (max-width: 480px) {
    font-size: 20px;
  }
`;

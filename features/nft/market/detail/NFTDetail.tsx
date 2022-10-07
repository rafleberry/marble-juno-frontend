import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { styled } from 'components/theme'
import { Button } from 'components/Button'
import DateCountdown from 'components/DateCountdownMin'
import { IconWrapper } from 'components/IconWrapper'
import { NftPrice, NftDollarPrice } from 'components/NFT/nft-card/price'
import { LoadingProgress } from 'components/LoadingProgress'
import { User, CopyNft, Heart, Clock, Package, Credit } from 'icons'
import { useHistory, useParams } from "react-router-dom";
import { RoundedIcon, RoundedIconComponent } from 'components/RoundedIcon'
import Card from './components/card'
import Link from 'next/link'
import {
  NftInfo,
  CW721,
  Collection,
  Market,
  useSdk,
  getRealTokenAmount,
  PaymentToken,
  SALE_TYPE,
  getFileTypeFromURL
} from "services/nft"
import { walletState } from 'state/atoms/walletAtoms'
import { useRecoilValue } from 'recoil'
import {
    ChakraProvider,
    Flex,
    Stack,
    Text,
    Grid,
    HStack,
} from '@chakra-ui/react'
import { BuyDialog } from 'features/nft/market/detail/BuyDialog'
import { OfferDialog } from 'features/nft/market/detail/OfferDialog'
import { useDispatch, useSelector } from "react-redux"
import { State } from 'store/reducers'
import { toast } from 'react-toastify'
import { NFTName, MoreTitle } from './styled'
import { isMobile } from 'util/device'
import SimpleTable from "./table";
import OnSaleModal from "./components/OnSaleModal";

interface DetailParams {
    readonly collectionId: string
    readonly id: string
}

interface MarketStatus {
    data?: any
    isOnMarket: boolean
    isStarted: boolean
    isEnded?: boolean
}

const PUBLIC_MARKETPLACE = process.env.NEXT_PUBLIC_MARKETPLACE || ''

export const NFTDetail = ({ collectionId, id}) => {
    const { client } = useSdk()
    const { address, client: signingClient } = useRecoilValue(walletState)
    const dispatch = useDispatch()
    const reloadData = useSelector((state: State) => state.reloadData)
    const { reload_status } = reloadData
    const [reloadCount, setReloadCount] = useState(0)
    const [isDisabled, setIsDisabled] = useState(false)
    const [marketStatus, setMarketStatus] = useState<MarketStatus>({
        isOnMarket: false,
        isStarted: false,
    })

    const [time, setTime] = useState(Math.round(new Date().getTime()/1000))

    const [nft, setNft] = useState<NftInfo & { created_at: string, description: string }>(
        {'tokenId': id, 'address': '', 'image': '', 'name': '', 'user': '', 'price': '0', 'total': 2, 'collectionName': "", 'symbol': 'Marble', 'sale':{}, 'paymentToken': {}, 'type': 'image', "created": "", "collectionId": 0, "created_at": "", "description": ""}
    )
    const [isBuyShowing, setIsBuyShowing] = useState(false)
    const [isOfferShowing, setIsOfferShowing] = useState(false)
    const [collectionInfo, setCollectionInfo] = useState<any>()
    
    const loadNft = useCallback(async () => {
        if (!client) return
        if (collectionId === undefined || collectionId == "[collection]" || id === undefined || id == "[id]")
            return false
        
        const marketContract = Market(PUBLIC_MARKETPLACE).use(client)
        let collection = await marketContract.collection(parseInt(collectionId))
        let ipfs_collection = await fetch(process.env.NEXT_PUBLIC_PINATA_URL + collection.uri)
        let res_collection = await ipfs_collection.json()
        const cw721Contract = CW721(collection.cw721_address).use(client)
        let nftInfo = await cw721Contract.nftInfo(id)

        setCollectionInfo(res_collection)
        
        let ipfs_nft = await fetch(process.env.NEXT_PUBLIC_PINATA_URL + nftInfo.token_uri)
        let res_nft = await ipfs_nft.json()
        let nft_type = await getFileTypeFromURL(process.env.NEXT_PUBLIC_PINATA_URL + res_nft["uri"])
        res_nft['type'] = nft_type.fileType
        res_nft["created"] = res_nft["owner"]
        res_nft["owner"] = await cw721Contract.ownerOf(id)

        console.log('nft', res_nft)
        
        const collectionContract = Collection(collection.collection_address).use(client)
        let sales:any = await collectionContract.getSales()
        let saleIds = []
        for (let i=0; i<sales.length; i++){
            saleIds.push(sales[i].token_id)
        }
        const response = await fetch(process.env.NEXT_PUBLIC_COLLECTION_TOKEN_LIST_URL)
        const paymentTokenList = await response.json()
        let paymentTokensAddress = []
        for (let i = 0; i < paymentTokenList.tokens.length; i++){
            paymentTokensAddress.push(paymentTokenList.tokens[i].address)
        }
        res_nft["owner"] = await cw721Contract.ownerOf(id)
        if (saleIds.indexOf(parseInt(id)) != -1){
            let sale = sales[saleIds.indexOf(parseInt(id))]
            let paymentToken: any
            if (sale.denom.hasOwnProperty("cw20")){
                paymentToken = paymentTokenList.tokens[paymentTokensAddress.indexOf(sale.denom.cw20)]
            }else{
                paymentToken = paymentTokenList.tokens[paymentTokensAddress.indexOf(sale.denom.native)]
            }
            res_nft["symbol"] = paymentToken.symbol
            res_nft["paymentToken"] = paymentToken
            res_nft["price"] = getRealTokenAmount({amount: sale.initial_price, denom: paymentToken.denom})
            res_nft["owner"] = sales[saleIds.indexOf(parseInt(id))].provider
            res_nft["sale"] = sales[saleIds.indexOf(parseInt(id))]
            res_nft["owner"] = sale.provider
        }else{
            res_nft["price"] = 0
            res_nft["sale"] = {}
        }
        let uri = res_nft.uri
        if (uri.indexOf("https://") == -1){
        uri = process.env.NEXT_PUBLIC_PINATA_URL + res_nft.uri
        }
        setNft({
            'tokenId': id, 
            'address': '', 
            'image': uri, 
            'name': res_nft.name, 
            'user': res_nft.owner, 
            'price': res_nft.price, 
            'total': 1, 
            'collectionName': res_collection.name, 
            'symbol': res_collection.tokens[0], 
            'sale': res_nft.sale,
            'paymentToken': res_nft.paymentToken,
            'type': res_nft.type,
            'created': res_nft.created,
            'collectionId': parseInt(collectionId),
            'created_at': res_nft.createdDate,
            'description': res_nft.description
        })
        console.log("sale", res_nft["sale"])
    }, [client])

    useEffect(() => {
        loadNft()
    }, [loadNft, collectionId, id, reloadCount]);

    useEffect(() => {
        let rCount = reloadCount + 1
        setReloadCount(rCount)

    }, [dispatch, reload_status])

    const cancelSale = async(e) => {
        e.preventDefault()
        setIsDisabled(true)
        const marketContract = Market(process.env.NEXT_PUBLIC_MARKETPLACE).use(client)
        let collection = await marketContract.collection(Number(collectionId))
        const collectionContract = Collection(collection.collection_address).useTx(signingClient)
        let cancel = await collectionContract.cancelSale(address, Number(nft.tokenId))
        
        toast.success(
        `You have cancelled this NFT successfully.`,
        {
            position: 'top-right',
            autoClose: 5000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
        }
        )
        setIsDisabled(false)
        nft.paymentToken = {}
        nft.price = "0"
        nft.sale = {}
        let rCount = reloadCount + 1
        setReloadCount(rCount)
        return false
    }
    const acceptSale = async(e) => {
        e.preventDefault()
        setIsDisabled(true)
        const marketContract = Market(process.env.NEXT_PUBLIC_MARKETPLACE).use(client)
        let collection = await marketContract.collection(Number(collectionId))
        const collectionContract = Collection(collection.collection_address).useTx(signingClient)
        let accept = await collectionContract.acceptSale(address, Number(nft.tokenId))
        
        toast.success(
        `You have accepted this NFT Auction successfully.`,
        {
            position: 'top-right',
            autoClose: 5000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
        }
        )
        setIsDisabled(false)
        nft.paymentToken = {}
        nft.price = "0"
        nft.sale = {}
        let rCount = reloadCount + 1
        setReloadCount(rCount)
        return false
    }
    useEffect(() => {
    }, [reloadCount])

    return (
        <ChakraProvider>
            <Stack>
                <Banner>
                    <BannerImage src={nft.image} alt="banner" />
                    <NFTImageWrapper>
                        <NFTImage src={nft.image} alt="nft-image" />
                    </NFTImageWrapper>
                </Banner>
            </Stack>

            <Container>
                <NFTInfoWrapper>
                    <NftInfoTag>
                        <NFTName>{nft.name}</NFTName>
                        <Stack
                            spacing={isMobile() ? 8 : 20}
                            flexDirection={isMobile() ? 'column' : 'row'}
                        >
                            <Stack spacing={3}>
                                <Text fontSize="14px">Collection</Text>
                                <Link href={`/collection/${collectionId}`}>
                                    <HStack style={{ cursor: 'pointer' }}>
                                        <RoundedIcon size="26px" src={nft.image} />
                                        <Text fontSize="14px" fontWeight="800" fontFamily="Mulish">
                                            {nft.collectionName}
                                        </Text>
                                    </HStack>
                                </Link>
                            </Stack>

                            <HStack
                                spacing={20}
                                justifyContent="flex-start"
                                marginTop={isMobile() ? 'auto' : '0 !important'}
                            >
                                <Stack spacing={3}>
                                    <Text fontSize="14px">Created By</Text>
                                    <HStack>
                                        {nft.created && (
                                            <RoundedIconComponent size="26px" address={nft.created} />
                                        )}
                                    </HStack>
                                </Stack>

                                <Stack spacing={3}>
                                    <Text fontSize="14px">Owned By</Text>
                                    
                                    <HStack>
                                        {nft.user && (
                                            <RoundedIconComponent size="26px" address={nft.user} />
                                        )}
                                    </HStack>
                                </Stack>
                            </HStack>
                        </Stack>

                        {/* TODO: mobile version */}
                        {isMobile() && (
                            <></>
                        )}

                        <Stack>
                            <Text fontSize={isMobile() ? '24px' : '28px'} fontWeight="700">
                                Royalty
                            </Text>
                            {
                                collectionInfo && collectionInfo.royalties.map((royalty, index) => (
                                    <Flex
                                        key={index}
                                        justifyContent="space-between"
                                        width={isMobile() ? '100%' : '50%'}
                                        alignItems="center"
                                    >
                                        <HStack>
                                            <RoundedIconComponent size="26px" address={royalty.address} />
                                        </HStack>
                                        <Text width="40%" textAlign="right">
                                            {royalty.rate / 10000} %
                                        </Text>
                                    </Flex>
                                ))
                            }
                        </Stack>

                        <Stack spacing={10}>
                            <Card title="Description">
                                <Text fontSize="18px" fontWeight="600" fontFamily="Mulish">
                                    {nft.description}
                                </Text>
                            </Card>

                            <Card title="Minted On">
                                <Text fontSize="18px" fontWeight="600" fontFamily="Mulish">
                                    {nft.created_at}
                                </Text>
                            </Card>
                        </Stack>
                    </NftInfoTag>

                    {
                        !isMobile() && (
                            <NftInfoTag>
                                {
                                    Object.keys(nft.sale).length > 0 ? (
                                        <NftBuyOfferTag className="nft-buy-offer">
                                            {
                                                nft.sale.sale_type === 'Auction' ? (
                                                    <>
                                                        {
                                                            nft.sale.duration_type.Time[0] < time ? (
                                                                <NftSale>
                                                                    <IconWrapper icon={<Clock />} />
                                                                    { nft.sale.duration_type.Time[1] < time ? 'Auction already ended' : 'Auction ends in' }
                                                                    {
                                                                        !(nft.sale.duration_type.Time[1] < time) && (
                                                                            <Text>
                                                                                <DateCountdown
                                                                                    dateTo={
                                                                                        nft.sale.duration_type.Time[1] ||
                                                                                        Date.now()
                                                                                    }
                                                                                    dateFrom={
                                                                                        nft.sale.duration_type.Time[0] ||
                                                                                        Date.now()
                                                                                    }
                                                                                    interval={0}
                                                                                    mostSignificantFigure="none"
                                                                                    numberOfFigures={3}
                                                                                    callback={() => undefined}
                                                                                />
                                                                            </Text>
                                                                        )
                                                                    }
                                                                </NftSale>
                                                            ) : (
                                                                <>
                                                                    Time {time}
                                                                </>
                                                            )
                                                        }
                                                    </>
                                                ) : (
                                                    <>
                                                        Not
                                                    </>
                                                )
                                            }
                                        </NftBuyOfferTag>
                                    ) : (
                                        <NftBuyOfferTag className="nft-buy-offer">
                                            <Text
                                                fontSize="25px"
                                                fontWeight="700"
                                                fontFamily="Mulish"
                                                textAlign="center"
                                            >
                                                {
                                                    nft.user === address
                                                        ? 'Manage NFT'
                                                        : 'This is not for a sale'
                                                }
                                            </Text>
                                            {
                                                nft.user == address && (
                                                    <PriceTag>
                                                        <Stack direction="row" spacing={4} marginTop="20px">
                                                            {/* OnSaleModal */}
                                                            <OnSaleModal collectionId={collectionId} id={id} />
                                                            {/* TransferModal */}
                                                            
                                                        </Stack>
                                                        {/* BurnNFTModal */}
                                                    </PriceTag>
                                                )
                                            }
                                        </NftBuyOfferTag>
                                    )
                                }
                                {
                                    Object.keys(nft.sale).length > 0 && nft.sale.requests.length > 0 && (
                                        <Card title="Bid History">
                                            <SimpleTable
                                                data={nft.sale.requests}
                                                unit={''}
                                                paymentToken={''}
                                            />
                                        </Card>
                                    )
                                }
                            </NftInfoTag>
                        )
                    }
                </NFTInfoWrapper>
            </Container>
        </ChakraProvider>
    )
}

const Container = styled('div', {
    padding: '50px',
    '@media (max-width: 480px)': {
      padding: '20px',
    },
})
const NFTInfoWrapper = styled('div', {
    display: 'flex',
    justifyContent: 'space-between',
    columnGap: '40px',
    '@media (max-width: 480px)': {
        flexDirection: 'column',
        rowGap: '40px',
    },
})

const NftInfoTag = styled('div', {
width: '50%',
height: '100%',
display: 'flex',
flexDirection: 'column',
rowGap: '40px',
'@media (max-width: 480px)': {
    width: '100%',
    rowGap: '20px',
},
})
const NftBuyOfferTag = styled('div', {
border: '1px solid rgba(255,255,255,0.2)',
borderRadius: '30px',
padding: '20px',
background: 'rgba(255,255,255,0.06)',
height: '100%',
marginBottom: '20px',
'@media (max-width: 480px)': {
    padding: '10px 0',
    background: 'rgba(5,6,21,0.2)',
    boxShadow:
    '0px 4px 40px rgba(42, 47, 50, 0.09), inset 0px 7px 24px #6D6D78',
},
})
const NftSale = styled('div', {
display: 'flex',
padding: '$12 $16',
alignItems: 'center',
gap: '$4',
borderBottom: '1px solid $borderColors$default',
'&.disabled': {
    color: '$textColors$disabled',
},
'@media (max-width: 480px)': {
    padding: '$4 $16',
},
})
const PriceTag = styled('div', {
display: 'flex',
flexDirection: 'column',
padding: '$12 $16',
' .price-lbl': {
    color: '$colors$link',
},
'@media (max-width: 480px)': {
    padding: '$4 $16',
},
})
const ButtonGroup = styled('div', {
display: 'flex',
gap: '$8',
marginTop: '$space$10',
' .btn-buy': {
    padding: '$space$10 $space$14',
    ' svg': {
    borderRadius: '2px',
    },
},
' .btn-offer': {
    padding: '$space$10 $space$14',
    border: '$borderWidths$1 solid $black',
    color: '$black',
    '&:hover': {
    background: '$white',
    color: '$textColors$primary',
    stroke: '$white',
    },
    ' svg': {
    border: '$borderWidths$1 solid $black',
    borderRadius: '2px',
    },
},
'@media (max-width: 480px)': {
    flexDirection: 'column',
},
})

const Span = styled('span', {
fontWeight: '600',
fontSize: '20px',
'@media (max-width: 480px)': {
    fontSize: '16px',
},
})

const Banner = styled('div', {
position: 'relative',
height: '950px',
width: '100%',
display: 'block',
paddingTop: '190px',
'@media (max-width: 480px)': {
    height: '560px',
    paddingTop: '60px',
},
})
const BannerImage = styled('img', {
position: 'absolute',
top: '0',
left: '0',
bottom: '0',
right: '0',
width: '100%',
height: '100%',
objectFit: 'cover',
objectPosition: 'center',
zIndex: '-1',
opacity: '0.1',
})
const NFTImageWrapper = styled('div', {
position: 'relative',
height: '700px',
width: '700px',
border: '1px solid rgba(255,255,255,0.2)',
background: 'rgba(255,255,255,0.06)',
display: 'block',
borderRadius: '30px',
margin: '0 auto',
'@media (max-width: 480px)': {
    height: '430px',
    width: '350px',
},
})
const NFTImage = styled('img', {
position: 'absolute',
top: '25px',
left: '25px',
bottom: '25px',
right: '25px',
width: 'calc(100% - 50px)',
height: 'calc(100% - 50px)',
objectFit: 'cover',
objectPosition: 'center',
zIndex: '-1',
borderRadius: '20px',
'@media (max-width: 480px)': {
    top: '20px',
    left: '20px',
    bottom: '20px',
    right: '20px',
    width: 'calc(100% - 40px)',
    height: 'calc(100% - 40px)',
},
})

const OwnerAction = styled('div', {

})
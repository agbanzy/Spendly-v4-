import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

interface VirtualCard {
  id: number;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  balance: number;
  currency: string;
  status: string;
  type: string;
}

interface SecureCardDetails {
  number: string;
  cvc: string;
  expMonth: number;
  expYear: number;
  last4: string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function CardsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();

  const { data: cards, isLoading, refetch } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get<VirtualCard[]>('/api/cards'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [fundModalVisible, setFundModalVisible] = React.useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<VirtualCard | null>(null);
  const [secureDetailsCardId, setSecureDetailsCardId] = React.useState<number | null>(null);

  const { data: secureDetails, isLoading: secureDetailsLoading } = useQuery({
    queryKey: ['cardDetails', secureDetailsCardId],
    queryFn: () => api.get<SecureCardDetails>(`/api/cards/${secureDetailsCardId}/details`),
    enabled: secureDetailsCardId !== null && detailsModalVisible,
  });
  const [fundAmount, setFundAmount] = React.useState('');
  const [revealedCvv, setRevealedCvv] = React.useState<Record<number, boolean>>({});
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  const [newCardName, setNewCardName] = React.useState('');
  const [newCardType, setNewCardType] = React.useState('virtual');

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.get<Array<{ currency: string; balance: string }>>('/api/wallets'),
  });

  const freezeMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'freeze' | 'unfreeze' }) =>
      api.post<VirtualCard>(`/api/cards/${id}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const fundMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      api.post<VirtualCard>(`/api/cards/${id}/fund`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      closeFundModal();
      Alert.alert('Success', 'Card funded successfully.');
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: string }) =>
      api.post<VirtualCard>('/api/cards', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setCreateModalVisible(false);
      setNewCardName('');
      setNewCardType('virtual');
      Alert.alert('Success', 'Card created successfully.');
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const handleCreateCard = () => {
    if (!newCardName.trim()) {
      Alert.alert('Validation', 'Please enter a cardholder name.');
      return;
    }
    createMutation.mutate({ name: newCardName.trim(), type: newCardType });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // First cancel in Stripe, then remove from DB
      await api.post(`/api/cards/${id}/cancel`, {});
      await api.delete(`/api/cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      closeDetailsModal();
      Alert.alert('Success', 'Card cancelled and deleted.');
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const handleDeleteCard = (card: VirtualCard) => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(card.id) },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleFreeze = (card: VirtualCard) => {
    const action: 'freeze' | 'unfreeze' = card.status === 'active' ? 'freeze' : 'unfreeze';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Card`,
      `Are you sure you want to ${action} this card?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: () => freezeMutation.mutate({ id: card.id, action }),
        },
      ]
    );
  };

  const openFundModal = (card: VirtualCard) => {
    setSelectedCard(card);
    setFundAmount('');
    setFundModalVisible(true);
  };

  const closeFundModal = () => {
    setFundModalVisible(false);
    setSelectedCard(null);
    setFundAmount('');
  };

  const handleFund = () => {
    if (!fundAmount.trim() || isNaN(parseFloat(fundAmount)) || parseFloat(fundAmount) <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }
    if (selectedCard) {
      fundMutation.mutate({ id: selectedCard.id, amount: parseFloat(fundAmount) });
    }
  };

  const openDetailsModal = (card: VirtualCard) => {
    setSelectedCard(card);
    setSecureDetailsCardId(card.id);
    setDetailsModalVisible(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedCard(null);
    setSecureDetailsCardId(null);
  };

  const toggleCvvReveal = (cardId: number) => {
    setRevealedCvv((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const formatCardNumber = (number: string) => {
    return number.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return colors.colorGreen;
      case 'frozen':
        return colors.infoLight;
      default:
        return colors.danger;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Virtual Cards</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setCreateModalVisible(true)} testID="button-add-card">
            <Ionicons name="add" size={24} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardsContainer}>
          {cards?.map((card, index) => (
            <View
              key={card.id}
              style={[
                styles.card,
                index % 2 === 0 ? styles.cardPrimary : styles.cardSecondary,
                card.status === 'frozen' && styles.cardFrozen,
              ]}
            >
              {card.status === 'frozen' && (
                <View style={styles.frozenOverlay}>
                  <Ionicons name="snow" size={16} color={colors.frozenBadgeText} />
                  <Text style={styles.frozenOverlayText}>FROZEN</Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={styles.cardType}>
                  <Ionicons name="card" size={24} color={colors.primaryForeground} />
                  <Text style={styles.cardTypeText}>{card.type}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${getStatusColor(card.status)}33` },
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(card.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(card.status) }]}>
                    {card.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardNumber}>{formatCardNumber(card.cardNumber)}</Text>

              <View style={styles.cardDetails}>
                <View>
                  <Text style={styles.cardLabel}>CARDHOLDER</Text>
                  <Text style={styles.cardValue}>{card.cardholderName}</Text>
                </View>
                <View>
                  <Text style={styles.cardLabel}>EXPIRES</Text>
                  <Text style={styles.cardValue}>{card.expiryDate}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleCvvReveal(card.id)}>
                  <Text style={styles.cardLabel}>CVV</Text>
                  <Text style={styles.cardValue}>
                    {revealedCvv[card.id] ? card.cvv : '***'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardBalance}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>
                  {formatCurrency(card.balance, card.currency)}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.cardAction}
                  onPress={() => handleFreeze(card)}
                  testID={`button-freeze-card-${card.id}`}
                >
                  <Ionicons
                    name={card.status === 'frozen' ? 'sunny' : 'snow'}
                    size={20}
                    color={colors.primaryForeground}
                  />
                  <Text style={styles.cardActionText}>
                    {card.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardAction}
                  onPress={() => openDetailsModal(card)}
                  testID={`button-details-card-${card.id}`}
                >
                  <Ionicons name="eye" size={20} color={colors.primaryForeground} />
                  <Text style={styles.cardActionText}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardAction}
                  onPress={() => openFundModal(card)}
                  testID={`button-fund-card-${card.id}`}
                >
                  <Ionicons name="add-circle" size={20} color={colors.primaryForeground} />
                  <Text style={styles.cardActionText}>Fund</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {(!cards || cards.length === 0) && !isLoading && (
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={64} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No virtual cards</Text>
              <Text style={styles.emptySubtext}>Create a virtual card to start spending</Text>
              <TouchableOpacity style={styles.createButton} onPress={() => setCreateModalVisible(true)} testID="button-create-first-card">
                <Ionicons name="add" size={20} color={colors.primaryForeground} />
                <Text style={styles.createButtonText}>Create Card</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fund Card Modal */}
      <Modal visible={fundModalVisible} animationType="slide" transparent testID="fund-modal">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fund Card</Text>
              <TouchableOpacity onPress={closeFundModal} testID="button-close-fund-modal">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {selectedCard && (() => {
                const cardCurrency = selectedCard.currency || 'USD';
                const wallet = wallets?.find(w => w.currency === cardCurrency);
                const walletBalance = wallet ? parseFloat(wallet.balance || '0') : 0;
                const enteredAmount = parseFloat(fundAmount) || 0;
                const insufficientFunds = enteredAmount > 0 && enteredAmount > walletBalance;
                const quickAmounts = [50, 100, 250, 500, 1000];

                return (
                  <>
                    <View style={styles.fundCardInfo}>
                      <Ionicons name="card" size={24} color={colors.accent} />
                      <View style={styles.fundCardDetails}>
                        <Text style={styles.fundCardName}>{selectedCard.cardholderName}</Text>
                        <Text style={styles.fundCardNumber}>
                          **** {selectedCard.cardNumber.slice(-4)}
                        </Text>
                      </View>
                      <Text style={styles.fundCardBalance}>
                        {formatCurrency(selectedCard.balance, cardCurrency)}
                      </Text>
                    </View>

                    <View style={styles.walletBalanceRow} testID="text-wallet-balance">
                      <Ionicons name="wallet" size={16} color={colors.accent} />
                      <Text style={styles.walletBalanceLabel}>Wallet Balance ({cardCurrency}):</Text>
                      <Text style={styles.walletBalanceValue}>{formatCurrency(walletBalance, cardCurrency)}</Text>
                    </View>

                    <Text style={styles.inputLabel}>Amount</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0.00"
                      placeholderTextColor={colors.placeholderText}
                      keyboardType="decimal-pad"
                      value={fundAmount}
                      onChangeText={setFundAmount}
                      testID="input-fund-amount"
                    />

                    <View style={styles.quickAmountsRow}>
                      {quickAmounts.map((amt) => (
                        <TouchableOpacity
                          key={amt}
                          style={[styles.quickAmountChip, fundAmount === String(amt) && styles.quickAmountChipActive]}
                          onPress={() => setFundAmount(String(amt))}
                          testID={`button-quick-amount-${amt}`}
                        >
                          <Text style={[styles.quickAmountText, fundAmount === String(amt) && styles.quickAmountTextActive]}>
                            ${amt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {insufficientFunds && (
                      <View style={styles.insufficientFundsRow} testID="text-insufficient-funds">
                        <Ionicons name="alert-circle" size={16} color={colors.danger} />
                        <Text style={styles.insufficientFundsText}>
                          Insufficient wallet balance. You need {formatCurrency(enteredAmount - walletBalance, cardCurrency)} more.
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeFundModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              {(() => {
                const cardCurrency = selectedCard?.currency || 'USD';
                const wallet = wallets?.find(w => w.currency === cardCurrency);
                const walletBalance = wallet ? parseFloat(wallet.balance || '0') : 0;
                const enteredAmount = parseFloat(fundAmount) || 0;
                const insufficientFunds = enteredAmount > 0 && enteredAmount > walletBalance;
                const isDisabled = fundMutation.isPending || insufficientFunds || enteredAmount <= 0;

                return (
                  <TouchableOpacity
                    style={[styles.saveButton, isDisabled && styles.saveButtonDisabled]}
                    onPress={handleFund}
                    disabled={isDisabled}
                    testID="button-confirm-fund"
                  >
                    {fundMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text style={styles.saveButtonText}>Fund Card</Text>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Card Details Modal */}
      <Modal visible={detailsModalVisible} animationType="slide" transparent testID="details-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Card Details</Text>
              <TouchableOpacity onPress={closeDetailsModal} testID="button-close-details-modal">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedCard && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Cardholder Name</Text>
                    <Text style={styles.detailValue}>{selectedCard.cardholderName}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="card-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Card Number</Text>
                    {secureDetailsLoading ? (
                      <ActivityIndicator size="small" color={colors.accent} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                    ) : (
                      <Text style={styles.detailValue}>
                        {secureDetails ? formatCardNumber(secureDetails.number) : `**** **** **** ${selectedCard.cardNumber.slice(-4)}`}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Expiry Date</Text>
                    <Text style={styles.detailValue}>
                      {secureDetails
                        ? `${String(secureDetails.expMonth).padStart(2, '0')}/${secureDetails.expYear}`
                        : selectedCard.expiryDate}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>CVV</Text>
                    {secureDetailsLoading ? (
                      <ActivityIndicator size="small" color={colors.accent} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                    ) : (
                      <Text style={styles.detailValue}>
                        {secureDetails ? secureDetails.cvc : '***'}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Balance</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedCard.balance, selectedCard.currency)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="layers-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>{selectedCard.type}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="ellipse" size={20} color={getStatusColor(selectedCard.status)} />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={[styles.detailValue, { color: getStatusColor(selectedCard.status) }]}>
                      {selectedCard.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionFreeze]}
                    onPress={() => {
                      closeDetailsModal();
                      setTimeout(() => handleFreeze(selectedCard), 300);
                    }}
                  >
                    <Ionicons
                      name={selectedCard.status === 'frozen' ? 'sunny' : 'snow'}
                      size={18}
                      color={colors.primaryForeground}
                    />
                    <Text style={styles.detailActionText}>
                      {selectedCard.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionFund]}
                    onPress={() => {
                      closeDetailsModal();
                      setTimeout(() => openFundModal(selectedCard), 300);
                    }}
                  >
                    <Ionicons name="add-circle" size={18} color={colors.primaryForeground} />
                    <Text style={styles.detailActionText}>Fund</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionDelete]}
                    onPress={() => {
                      if (selectedCard) handleDeleteCard(selectedCard);
                    }}
                  >
                    <Ionicons name="trash" size={18} color={colors.primaryForeground} />
                    <Text style={styles.detailActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Card Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Card</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Cardholder Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter cardholder name"
                placeholderTextColor={colors.placeholderText}
                value={newCardName}
                onChangeText={setNewCardName}
              />

              <Text style={styles.inputLabel}>Card Type</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                {['virtual', 'physical'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.cardTypeChip,
                      newCardType === type && styles.cardTypeChipActive,
                    ]}
                    onPress={() => setNewCardType(type)}
                  >
                    <Ionicons
                      name={type === 'virtual' ? 'phone-portrait' : 'card'}
                      size={16}
                      color={newCardType === type ? colors.primaryForeground : colors.textSecondary}
                    />
                    <Text style={[
                      styles.cardTypeText_chip,
                      newCardType === type && { color: colors.primaryForeground },
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, createMutation.isPending && styles.saveButtonDisabled]}
                onPress={handleCreateCard}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.saveButtonText}>Create Card</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardsContainer: {
      padding: 20,
      paddingTop: 0,
    },
    card: {
      width: CARD_WIDTH,
      borderRadius: 20,
      padding: 24,
      marginBottom: 20,
    },
    cardPrimary: {
      backgroundColor: colors.cardPrimary,
    },
    cardSecondary: {
      backgroundColor: colors.cardSecondary,
    },
    cardFrozen: {
      opacity: 0.85,
    },
    frozenOverlay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.frozenBadgeBg,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 12,
    },
    frozenOverlayText: {
      color: colors.frozenBadgeText,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    cardType: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTypeText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 12,
      textTransform: 'capitalize',
      fontWeight: '500',
    },
    cardNumber: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.primaryForeground,
      letterSpacing: 2,
      marginBottom: 24,
    },
    cardDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    cardLabel: {
      fontSize: 10,
      color: colors.cardTextMuted,
      marginBottom: 4,
    },
    cardValue: {
      fontSize: 14,
      color: colors.primaryForeground,
      fontWeight: '500',
    },
    cardBalance: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    balanceLabel: {
      fontSize: 12,
      color: colors.cardTextMuted,
    },
    balanceAmount: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primaryForeground,
      marginTop: 4,
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    cardAction: {
      alignItems: 'center',
      gap: 4,
    },
    cardActionText: {
      fontSize: 12,
      color: colors.cardTextSoft,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 60,
    },
    emptyText: {
      fontSize: 18,
      color: colors.textSecondary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 4,
      textAlign: 'center',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 24,
      gap: 8,
    },
    createButtonText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: '600',
    },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalBody: {
      padding: 20,
    },
    inputLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      color: colors.inputText,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    modalFooter: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontWeight: '600',
    },

    // Fund card info
    fundCardInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fundCardDetails: {
      flex: 1,
    },
    fundCardName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    fundCardNumber: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: 2,
    },
    fundCardBalance: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },
    walletBalanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.accentBackground,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 12,
    },
    walletBalanceLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    walletBalanceValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
      marginLeft: 'auto',
    },
    quickAmountsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    quickAmountChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    quickAmountChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    quickAmountText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    quickAmountTextActive: {
      color: colors.primaryForeground,
    },
    insufficientFundsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerSubtleBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 12,
    },
    insufficientFundsText: {
      flex: 1,
      fontSize: 12,
      color: colors.danger,
    },

    // Details modal
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 14,
    },
    detailInfo: {
      flex: 1,
    },
    detailLabel: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    detailValue: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500',
      marginTop: 2,
    },
    detailActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    detailActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
    },
    detailActionFreeze: {
      backgroundColor: colors.border,
    },
    detailActionFund: {
      backgroundColor: colors.primary,
    },
    detailActionDelete: {
      backgroundColor: colors.danger,
    },
    detailActionText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontWeight: '600',
    },

    // Card type chips
    cardTypeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    cardTypeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    cardTypeText_chip: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  });
}

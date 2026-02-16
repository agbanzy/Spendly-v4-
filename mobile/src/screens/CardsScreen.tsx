import React from 'react';
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

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function CardsScreen() {
  const queryClient = useQueryClient();

  const { data: cards, isLoading, refetch } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get<VirtualCard[]>('/api/cards'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [fundModalVisible, setFundModalVisible] = React.useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<VirtualCard | null>(null);
  const [fundAmount, setFundAmount] = React.useState('');
  const [revealedCvv, setRevealedCvv] = React.useState<Record<number, boolean>>({});

  const freezeMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch<VirtualCard>(`/api/cards/${id}`, { status }),
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

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleFreeze = (card: VirtualCard) => {
    const newStatus = card.status === 'active' ? 'frozen' : 'active';
    const action = card.status === 'active' ? 'freeze' : 'unfreeze';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Card`,
      `Are you sure you want to ${action} this card?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: () => freezeMutation.mutate({ id: card.id, status: newStatus }),
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
    setDetailsModalVisible(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedCard(null);
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
        return '#34D399';
      case 'frozen':
        return '#60A5FA';
      default:
        return '#EF4444';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Virtual Cards</Text>
          <TouchableOpacity style={styles.addButton} testID="button-add-card">
            <Ionicons name="add" size={24} color="#FFFFFF" />
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
                  <Ionicons name="snow" size={16} color="#60A5FA" />
                  <Text style={styles.frozenOverlayText}>FROZEN</Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={styles.cardType}>
                  <Ionicons name="card" size={24} color="#FFFFFF" />
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
                    color="#FFFFFF"
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
                  <Ionicons name="eye" size={20} color="#FFFFFF" />
                  <Text style={styles.cardActionText}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardAction}
                  onPress={() => openFundModal(card)}
                  testID={`button-fund-card-${card.id}`}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.cardActionText}>Fund</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {(!cards || cards.length === 0) && !isLoading && (
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={64} color="#64748B" />
              <Text style={styles.emptyText}>No virtual cards</Text>
              <Text style={styles.emptySubtext}>Create a virtual card to start spending</Text>
              <TouchableOpacity style={styles.createButton} testID="button-create-first-card">
                <Ionicons name="add" size={20} color="#FFFFFF" />
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
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {selectedCard && (
                <View style={styles.fundCardInfo}>
                  <Ionicons name="card" size={24} color="#818CF8" />
                  <View style={styles.fundCardDetails}>
                    <Text style={styles.fundCardName}>{selectedCard.cardholderName}</Text>
                    <Text style={styles.fundCardNumber}>
                      **** {selectedCard.cardNumber.slice(-4)}
                    </Text>
                  </View>
                  <Text style={styles.fundCardBalance}>
                    {formatCurrency(selectedCard.balance, selectedCard.currency)}
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                value={fundAmount}
                onChangeText={setFundAmount}
                testID="input-fund-amount"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeFundModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, fundMutation.isPending && styles.saveButtonDisabled]}
                onPress={handleFund}
                disabled={fundMutation.isPending}
                testID="button-confirm-fund"
              >
                {fundMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Fund Card</Text>
                )}
              </TouchableOpacity>
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
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {selectedCard && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={20} color="#94A3B8" />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Cardholder Name</Text>
                    <Text style={styles.detailValue}>{selectedCard.cardholderName}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="card-outline" size={20} color="#94A3B8" />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Card Number</Text>
                    <Text style={styles.detailValue}>
                      {formatCardNumber(selectedCard.cardNumber)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={20} color="#94A3B8" />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Expiry Date</Text>
                    <Text style={styles.detailValue}>{selectedCard.expiryDate}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>CVV</Text>
                    <Text style={styles.detailValue}>{selectedCard.cvv}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={20} color="#94A3B8" />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Balance</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedCard.balance, selectedCard.currency)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="layers-outline" size={20} color="#94A3B8" />
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
                      color="#FFFFFF"
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
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.detailActionText}>Fund</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    color: '#FFFFFF',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
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
    backgroundColor: '#4F46E5',
  },
  cardSecondary: {
    backgroundColor: '#7C3AED',
  },
  cardFrozen: {
    opacity: 0.85,
  },
  frozenOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  frozenOverlayText: {
    color: '#60A5FA',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  cardBalance: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    color: 'rgba(255, 255, 255, 0.8)',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
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
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Fund card info
  fundCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fundCardDetails: {
    flex: 1,
  },
  fundCardName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  fundCardNumber: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  fundCardBalance: {
    color: '#818CF8',
    fontSize: 14,
    fontWeight: '700',
  },

  // Details modal
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 14,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: '#334155',
  },
  detailActionFund: {
    backgroundColor: '#4F46E5',
  },
  detailActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
